using CardDatabase.DataAccess;
using HarmonyLib;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace PTCGLiveZhMod.Patches
{
    /// <summary>
    /// 卡牌详情放大时显示中文翻译悬浮框
    /// 覆盖两种场景：
    /// 1. 主页浏览卡牌（BigCardOverlayController.SetupLargeCard）
    /// 2. 战斗中点击卡牌放大查看（SingleCardViewMenu.Show）
    /// 悬浮框显示在屏幕右侧
    /// </summary>
    internal static class CardDetailTooltipPatcher
    {
        private static GameObject tooltipRoot;
        private static TextMeshProUGUI tooltipText;
        private static readonly Vector2 tooltipSize = new Vector2(320f, 500f);

        // ===========================
        // 场景1: 主页卡牌浏览（BigCardOverlayController）
        // ===========================

        /// <summary>
        /// Hook BigCardOverlayController.Setup - 主页点击卡牌放大时触发
        /// Setup 是所有主页卡牌放大详情的入口方法
        /// 在第53186行设置了 selectedCard = archetypeStack.GetPreferredDisplayCard()
        /// 通过反射获取 selectedCard 属性的 LongFormID（即 cardSourceID）
        /// </summary>
        [HarmonyPatch(typeof(BigCardOverlayController), "Setup")]
        [HarmonyPostfix]
        static void SetupPostfix(object __instance)
        {
            try
            {
                // 通过反射获取 selectedCard 属性（protected ICardDataRow）
                var selectedCardProp = __instance.GetType().GetProperty("selectedCard",
                    System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public);

                if (selectedCardProp == null) return;

                var cardDataRow = selectedCardProp.GetValue(__instance);
                if (cardDataRow == null) return;

                // 通过反射获取 LongFormID（等同于 cardSourceID，格式如 "swsh1_123_SV"）
                var longFormIdProp = cardDataRow.GetType().GetProperty("LongFormID");
                if (longFormIdProp == null) return;

                var longFormId = (string)longFormIdProp.GetValue(cardDataRow);
                if (string.IsNullOrEmpty(longFormId)) return;

                ShowDetailTooltip(longFormId, isRight: true);
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogWarning("CardDetailTooltip [主页]: 获取卡牌信息失败 - " + ex.Message);
            }
        }

        /// <summary>
        /// Hook BigCardOverlayController.OnDeActivate - 关闭主页卡牌详情时隐藏悬浮框
        /// </summary>
        [HarmonyPatch(typeof(BigCardOverlayController), "OnDeActivate")]
        [HarmonyPostfix]
        static void OnDeActivatePostfix()
        {
            HideDetailTooltip();
        }

        // ===========================
        // 场景2: 战斗中点击卡牌放大（SingleCardViewMenu）
        // ===========================

        /// <summary>
        /// Hook SingleCardViewMenu.Show - 战斗中点击卡牌放大查看时触发
        /// 通过反射从 Card3D 参数获取 cardInfo.cardSourceID
        /// </summary>
        [HarmonyPatch(typeof(SingleCardViewMenu), "Show")]
        [HarmonyPostfix]
        static void ShowPostfix(object __0) // __0 = Card3D card
        {
            try
            {
                if (__0 == null) return;

                var card3DType = __0.GetType();
                var cardInfoProp = card3DType.GetProperty("cardInfo");
                if (cardInfoProp == null) return;

                var cardInfo = cardInfoProp.GetValue(__0);
                if (cardInfo == null) return;

                var cardSourceIdProp = cardInfo.GetType().GetProperty("cardSourceID");
                if (cardSourceIdProp == null) return;

                var cardSourceId = (string)cardSourceIdProp.GetValue(cardInfo);
                if (string.IsNullOrEmpty(cardSourceId)) return;

                ShowDetailTooltip(cardSourceId, isRight: true);
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogWarning("CardDetailTooltip [战斗]: 获取卡牌信息失败 - " + ex.Message);
            }
        }

        /// <summary>
        /// Hook SingleCardViewMenu.OnClose - 战斗中关闭卡牌放大时隐藏悬浮框
        /// 签名: public sealed override void OnClose(BattleMenu NextMenu)
        /// </summary>
        [HarmonyPatch(typeof(SingleCardViewMenu), "OnClose")]
        [HarmonyPostfix]
        static void OnClosePostfix()
        {
            HideDetailTooltip();
        }

        // ===========================
        // 共用 UI 创建和显示逻辑
        // ===========================

        private static void ShowDetailTooltip(string cardSourceId, bool isRight)
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
            }
            else
            {
                tooltipText.text = BuildCardText(cardDataRow);
            }

            PositionTooltip(isRight);
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
                // 查找活跃的 Canvas
                var canvasObj = FindActiveCanvas();

                if (canvasObj == null)
                {
                    Plugin.LoggerInstance.LogWarning("CardDetailTooltip: 未找到 Canvas，无法创建悬浮框");
                    return;
                }

                // 创建悬浮框根节点
                tooltipRoot = new GameObject("ZhCardDetailTooltip");
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

                // 滚动区域
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

                var contentFitter = contentObj.AddComponent<ContentSizeFitter>();
                contentFitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
                contentFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

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

                Plugin.LoggerInstance.LogInfo("CardDetailTooltip: 悬浮框创建成功");
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogError("CardDetailTooltip: 创建悬浮框失败 - " + ex.Message);
                tooltipRoot = null;
            }
        }

        private static void PositionTooltip(bool isRight)
        {
            if (tooltipRoot == null) return;

            var rect = tooltipRoot.GetComponent<RectTransform>();

            if (isRight)
            {
                // 屏幕右侧
                rect.anchorMin = new Vector2(1f, 0.5f);
                rect.anchorMax = new Vector2(1f, 0.5f);
                rect.pivot = new Vector2(1f, 0.5f);
                rect.anchoredPosition = new Vector2(-20f, 0f);
            }
            else
            {
                // 屏幕左侧
                rect.anchorMin = new Vector2(0f, 0.5f);
                rect.anchorMax = new Vector2(0f, 0.5f);
                rect.pivot = new Vector2(0f, 0.5f);
                rect.anchoredPosition = new Vector2(20f, 0f);
            }
        }

        private static void HideDetailTooltip()
        {
            if (tooltipRoot != null)
            {
                tooltipRoot.SetActive(false);
            }
        }

        private static GameObject FindActiveCanvas()
        {
            var canvases = Object.FindObjectsOfType<Canvas>();
            if (canvases == null) return null;

            // 优先选择 Overlay 模式的 Canvas
            foreach (var canvas in canvases)
            {
                if (canvas != null && canvas.gameObject.activeInHierarchy
                    && canvas.renderMode == RenderMode.ScreenSpaceOverlay)
                {
                    return canvas.gameObject;
                }
            }

            // 没找到 Overlay，返回第一个活跃的
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
