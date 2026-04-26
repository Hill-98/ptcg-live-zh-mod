using CardDatabase.DataAccess;
using HarmonyLib;
using SharedLogicUtils.source.CardData;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

// 全局命名空间中的类型（来自 TPCI.RainierClient.dll）
// MonoSingleton, ManagerSingleton, BigCardHoverMenu, MatchManager 等

namespace PTCGLiveZhMod.Patches
{
    /// <summary>
    /// 战斗中卡牌悬停预览时显示中文翻译悬浮框
    /// Hook BigCardHoverMenu.SetHoverCardVisibility，在悬停卡牌旁显示翻译信息
    /// </summary>
    internal static class CardHoverTooltipPatcher
    {
        private static GameObject tooltipRoot;
        private static TextMeshProUGUI tooltipText;
        private static Canvas tooltipCanvas;
        private static readonly Vector2 tooltipSize = new Vector2(320f, 500f);
        private static readonly float tooltipOffsetX = -340f;
        private static readonly float tooltipOffsetY = 0f;
        private static string lastCardSourceId;

        /// <summary>
        /// Hook SetHoverCardVisibility - 卡牌悬停预览显示/隐藏时触发
        /// </summary>
        [HarmonyPatch(typeof(BigCardHoverMenu), "SetHoverCardVisibility")]
        [HarmonyPostfix]
        static void SetHoverCardVisibilityPostfix(bool isVisible)
        {
            if (!isVisible)
            {
                HideTooltip();
                lastCardSourceId = null;
                return;
            }

            // 获取当前聚焦的卡牌信息（完全通过反射，避免引用 RainierClientSDK.CardInfo 类型）
            try
            {
                var matchManager = MonoSingleton<MatchManager>.instance;
                if (matchManager == null)
                {
                    return;
                }

                // 通过反射获取 debugFocusedCardInfo 字段的 cardSourceID
                var cardInfoField = matchManager.GetType().GetField("debugFocusedCardInfo");
                if (cardInfoField == null)
                {
                    return;
                }

                var cardInfo = cardInfoField.GetValue(matchManager);
                if (cardInfo == null)
                {
                    return;
                }

                var cardSourceIdProp = cardInfo.GetType().GetProperty("cardSourceID");
                if (cardSourceIdProp == null)
                {
                    return;
                }

                var cardSourceId = (string)cardSourceIdProp.GetValue(cardInfo);
                if (string.IsNullOrEmpty(cardSourceId))
                {
                    return;
                }

                lastCardSourceId = cardSourceId;
                ShowTooltip(cardSourceId);
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogWarning("CardHoverTooltip: 获取卡牌信息失败 - " + ex.Message);
            }
        }

        /// <summary>
        /// Hook Close - 悬停预览关闭时隐藏悬浮框
        /// </summary>
        [HarmonyPatch(typeof(BigCardHoverMenu), "Close")]
        [HarmonyPostfix]
        static void ClosePostfix()
        {
            HideTooltip();
            lastCardSourceId = null;
        }

        private static void ShowTooltip(string cardSourceId)
        {
            EnsureTooltipCreated();

            if (tooltipRoot == null || tooltipText == null)
            {
                return;
            }

            // 从 CardDatabaseManager 获取 CardDataRow（已被汉化插件处理过）
            var cardDataRow = ManagerSingleton<CardDatabaseManager>.instance
                .TryGetCardFromDatabase(cardSourceId);

            if (cardDataRow == null)
            {
                tooltipText.text = $"<size=22><b>卡牌数据未找到</b></size>\n<size=16>{cardSourceId}</size>";
                PositionTooltip();
                tooltipRoot.SetActive(true);
                return;
            }

            // 构建翻译文本
            string text = BuildCardText(cardDataRow);
            tooltipText.text = text;

            // 定位和显示
            PositionTooltip();
            tooltipRoot.SetActive(true);

            // 强制重建布局
            LayoutRebuilder.ForceRebuildLayoutImmediate(
                tooltipRoot.GetComponent<RectTransform>());
        }

        private static string BuildCardText(CardDataRow card)
        {
            var sb = new System.Text.StringBuilder();

            // 卡牌名称（已被汉化插件翻译）
            string cardName = card.LocalizedCardName ?? card.EnglishCardName;
            sb.AppendLine($"<size=24><b>{cardName}</b></size>");
            sb.AppendLine();

            if (card.IsPokemonCard())
            {
                // 属性
                string typing = card.CardTyping ?? "";
                sb.AppendLine($"<size=16>属性: {typing}</size>");
                sb.AppendLine($"<size=16>HP: {card.HP}</size>");
                sb.AppendLine();

                // 招式
                int attackIndex = 1;
                foreach (var action in card.GetActionInfos())
                {
                    if (action.IsImplicitAction && string.IsNullOrEmpty(action.EnglishName))
                    {
                        // 宝可梦特性 (Ability)
                        sb.AppendLine($"<size=18><b>{action.LocalizedName}</b></size>");
                        sb.AppendLine($"<size=14>{action.LocalizedDescription}</size>");
                        sb.AppendLine();
                    }
                    else if (!string.IsNullOrEmpty(action.EnglishName))
                    {
                        // 招式
                        sb.AppendLine($"<size=18><b>招式{attackIndex}: {action.LocalizedName}</b></size>");

                        // 费用
                        if (!string.IsNullOrEmpty(action.Cost))
                        {
                            sb.Append($"<size=14>费用: {action.Cost}</size>");
                        }

                        // 伤害
                        if (!string.IsNullOrEmpty(action.Damage))
                        {
                            sb.Append($"  伤害: <size=16>{action.Damage}</size>");
                        }
                        sb.AppendLine();

                        // 描述
                        if (!string.IsNullOrEmpty(action.LocalizedDescription))
                        {
                            sb.AppendLine($"<size=14>{action.LocalizedDescription}</size>");
                        }
                        sb.AppendLine();
                        attackIndex++;
                    }
                }

                // 弱点
                if (!string.IsNullOrEmpty(card.WeaknessType))
                {
                    sb.AppendLine($"<size=14>弱点: {card.WeaknessType} ×{card.WeaknessAmount}</size>");
                }

                // 抵抗力
                if (!string.IsNullOrEmpty(card.ResistanceType))
                {
                    sb.AppendLine($"<size=14>抵抗力: {card.ResistanceType} -{card.ResistanceAmount}</size>");
                }

                // 撤退费用
                sb.AppendLine($"<size=14>撤退费用: {card.RetreatCost}</size>");
            }
            else if (card.IsTrainerCard())
            {
                // 训练家卡
                sb.AppendLine($"<size=16>训练家卡</size>");
                sb.AppendLine();

                foreach (var action in card.GetActionInfos())
                {
                    if (!string.IsNullOrEmpty(action.EnglishName))
                    {
                        sb.AppendLine($"<size=18><b>{action.LocalizedName}</b></size>");
                    }
                    if (!string.IsNullOrEmpty(action.LocalizedDescription))
                    {
                        sb.AppendLine($"<size=14>{action.LocalizedDescription}</size>");
                    }
                    sb.AppendLine();
                }
            }
            else if (card.IsBasicEnergy() || card.IsSpecialEnergy())
            {
                // 能量卡
                sb.AppendLine($"<size=16>能量卡</size>");
                sb.AppendLine();

                foreach (var action in card.GetActionInfos())
                {
                    if (!string.IsNullOrEmpty(action.EnglishName))
                    {
                        sb.AppendLine($"<size=18><b>{action.LocalizedName}</b></size>");
                    }
                    if (!string.IsNullOrEmpty(action.LocalizedDescription))
                    {
                        sb.AppendLine($"<size=14>{action.LocalizedDescription}</size>");
                    }
                    sb.AppendLine();
                }
            }

            return sb.ToString();
        }

        private static void EnsureTooltipCreated()
        {
            if (tooltipRoot != null) return;

            try
            {
                // 查找战斗场景中的 Canvas
                var canvasObj = FindActiveCanvas();

                if (canvasObj == null)
                {
                    Plugin.LoggerInstance.LogWarning("CardHoverTooltip: 未找到 Canvas，无法创建悬浮框");
                    return;
                }

                tooltipCanvas = canvasObj.GetComponent<Canvas>();
                if (tooltipCanvas == null)
                {
                    tooltipCanvas = canvasObj.AddComponent<Canvas>();
                }

                // 创建悬浮框根节点
                tooltipRoot = new GameObject("ZhCardHoverTooltip");
                tooltipRoot.transform.SetParent(canvasObj.transform, false);

                var rootRect = tooltipRoot.AddComponent<RectTransform>();
                rootRect.sizeDelta = tooltipSize;

                // 黑色半透明背景
                var bgObj = new GameObject("Background");
                bgObj.transform.SetParent(tooltipRoot.transform, false);
                var bgRect = bgObj.AddComponent<RectTransform>();
                bgRect.anchorMin = Vector2.zero;
                bgRect.anchorMax = Vector2.one;
                bgRect.offsetMin = Vector2.zero;
                bgRect.offsetMax = Vector2.zero;
                var bgImage = bgObj.AddComponent<Image>();
                bgImage.color = new Color(0f, 0f, 0f, 0.85f);

                // 遮罩
                bgObj.AddComponent<RectMask2D>();

                // 滚动区域（防止内容过长超出）
                var scrollObj = new GameObject("Scroll View");
                scrollObj.transform.SetParent(tooltipRoot.transform, false);
                var scrollRect = scrollObj.AddComponent<RectTransform>();
                scrollRect.anchorMin = new Vector2(0.05f, 0.03f);
                scrollRect.anchorMax = new Vector2(0.95f, 0.97f);
                scrollRect.offsetMin = Vector2.zero;
                scrollRect.offsetMax = Vector2.zero;

                var scroll = scrollObj.AddComponent<ScrollRect>();
                scroll.horizontal = false;
                scroll.vertical = true;
                scroll.movementType = ScrollRect.MovementType.Clamped;
                scroll.scrollSensitivity = 30f;
                scroll.elasticity = 0.1f;

                // 内容容器
                var contentObj = new GameObject("Content");
                contentObj.transform.SetParent(scrollObj.transform, false);
                var contentRect = contentObj.AddComponent<RectTransform>();
                contentRect.anchorMin = new Vector2(0f, 1f);
                contentRect.anchorMax = new Vector2(1f, 1f);
                contentRect.pivot = new Vector2(0.5f, 1f);
                contentRect.sizeDelta = new Vector2(0f, 0f);

                // 内容尺寸适配器
                var contentFitter = contentObj.AddComponent<ContentSizeFitter>();
                contentFitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
                contentFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

                // 垂直布局
                var layout = contentObj.AddComponent<VerticalLayoutGroup>();
                layout.childAlignment = TextAnchor.UpperLeft;
                layout.padding = new RectOffset(8, 8, 8, 8);
                layout.spacing = 2;
                layout.childForceExpandWidth = true;
                layout.childForceExpandHeight = false;

                scroll.content = contentRect;

                // 文本组件
                var textObj = new GameObject("TooltipText");
                textObj.transform.SetParent(contentObj.transform, false);
                var textRect = textObj.AddComponent<RectTransform>();
                textRect.anchorMin = new Vector2(0f, 1f);
                textRect.anchorMax = new Vector2(1f, 1f);
                textRect.pivot = new Vector2(0.5f, 1f);
                textRect.sizeDelta = new Vector2(0f, 0f);

                tooltipText = textObj.AddComponent<TextMeshProUGUI>();
                tooltipText.color = Color.white;
                tooltipText.fontSize = 16;
                tooltipText.fontSizeMin = 12;
                tooltipText.fontSizeMax = 28;
                tooltipText.enableAutoSizing = false;
                tooltipText.enableWordWrapping = true;
                tooltipText.overflowMode = TextOverflowModes.Overflow;
                tooltipText.alignment = TextAlignmentOptions.TopLeft;
                tooltipText.richText = true;

                // 默认隐藏
                tooltipRoot.SetActive(false);

                Plugin.LoggerInstance.LogInfo("CardHoverTooltip: 悬浮框创建成功");
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogError("CardHoverTooltip: 创建悬浮框失败 - " + ex.Message);
                tooltipRoot = null;
            }
        }

        private static void PositionTooltip()
        {
            if (tooltipRoot == null) return;

            var rect = tooltipRoot.GetComponent<RectTransform>();

            // 将悬浮框放到屏幕中央偏左
            rect.anchorMin = new Vector2(0.5f, 0.5f);
            rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);

            // 偏移到左侧
            rect.anchoredPosition = new Vector2(tooltipOffsetX, tooltipOffsetY);
        }

        private static void HideTooltip()
        {
            if (tooltipRoot != null)
            {
                tooltipRoot.SetActive(false);
            }
        }

        private static GameObject FindActiveCanvas()
        {
            // 遍历所有 Canvas 找到一个合适的
            var canvases = Object.FindObjectsOfType<Canvas>();
            if (canvases == null) return null;

            foreach (var canvas in canvases)
            {
                if (canvas != null && canvas.gameObject.activeInHierarchy)
                {
                    // 优先选择 Overlay 模式的 Canvas
                    if (canvas.renderMode == RenderMode.ScreenSpaceOverlay)
                    {
                        return canvas.gameObject;
                    }
                }
            }

            // 如果没找到 Overlay，返回第一个活跃的
            foreach (var canvas in canvases)
            {
                if (canvas != null && canvas.gameObject.activeInHierarchy)
                {
                    return canvas.gameObject;
                }
            }

            return null;
        }
    }
}
