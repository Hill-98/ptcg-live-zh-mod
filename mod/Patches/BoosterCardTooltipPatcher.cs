using CardDatabase.DataAccess;
using HarmonyLib;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace PTCGLiveZhMod.Patches
{
    /// <summary>
    /// 开包翻卡时显示中文翻译悬浮框
    /// Hook ContentItem3DAsset_BoosterCard 的 SetRevealTrigger / OnOutroAnimationComplete
    /// 样式与 CardDetailTooltipPatcher 完全一致：右侧竖条 320×500
    /// 
    /// 逻辑：开包每张卡通过 SetRevealTrigger 开始展示，显示翻译；
    /// 切换到下一张时也会调用 SetRevealTrigger 更新翻译；
    /// 只有最后一张卡完成 Outro 动画时才隐藏。
    /// </summary>
    internal static class BoosterCardTooltipPatcher
    {
        private static GameObject tooltipRoot;
        private static TextMeshProUGUI tooltipText;
        private static readonly Vector2 tooltipSize = new Vector2(320f, 500f);
        private static bool isLastCard = false;

        /// <summary>
        /// Hook SetRevealTrigger(bool isLastCard) - 每次卡牌准备展示时触发（动画开始前）
        /// 无论翻没翻开都更新翻译，保持持续显示
        /// </summary>
        [HarmonyPatch(typeof(ContentItem3DAsset_BoosterCard), "SetRevealTrigger")]
        [HarmonyPostfix]
        static void SetRevealTriggerPostfix(object __instance, bool isLastCard)
        {
            // 记录当前卡是否是最后一张
            BoosterCardTooltipPatcher.isLastCard = isLastCard;

            try
            {
                // 通过反射获取 cardData 属性（CardDataRow 类型）
                var cardDataProp = __instance.GetType().GetProperty("cardData");
                if (cardDataProp == null) return;

                var cardData = cardDataProp.GetValue(__instance);
                if (cardData == null) return;

                if (cardData is CardDataRow cardDataRow)
                {
                    ShowBoosterTooltip(cardDataRow);
                }
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogWarning("BoosterCardTooltip [翻卡]: 获取卡牌信息失败 - " + ex.Message);
            }
        }

        /// <summary>
        /// Hook OnOutroAnimationComplete - 只在最后一张卡退出时隐藏悬浮框
        /// 非最后一张卡的 Outro 不隐藏，因为下一张会立刻 SetRevealTrigger 更新翻译
        /// </summary>
        [HarmonyPatch(typeof(ContentItem3DAsset_BoosterCard), "OnOutroAnimationComplete")]
        [HarmonyPostfix]
        static void OnOutroAnimationCompletePostfix()
        {
            if (isLastCard)
            {
                HideBoosterTooltip();
                isLastCard = false;
            }
            // 非最后一张不隐藏，等下一张 SetRevealTrigger 更新
        }

        private static void ShowBoosterTooltip(CardDataRow cardDataRow)
        {
            EnsureTooltipCreated();

            if (tooltipRoot == null || tooltipText == null) return;

            tooltipText.text = BuildCardText(cardDataRow);

            PositionTooltip();
            tooltipRoot.SetActive(true);

            // 强制重建布局
            LayoutRebuilder.ForceRebuildLayoutImmediate(
                tooltipRoot.GetComponent<RectTransform>());
        }

        /// <summary>
        /// 构建卡牌翻译文本（与 CardDetailTooltipPatcher 完全一致）
        /// </summary>
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
                var canvasObj = FindActiveCanvas();
                if (canvasObj == null)
                {
                    Plugin.LoggerInstance.LogWarning("BoosterCardTooltip: 未找到 Canvas，无法创建悬浮框");
                    return;
                }

                // 创建悬浮框根节点
                tooltipRoot = new GameObject("ZhBoosterCardTooltip");
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

                Plugin.LoggerInstance.LogInfo("BoosterCardTooltip: 开包翻译悬浮框创建成功");
            }
            catch (System.Exception ex)
            {
                Plugin.LoggerInstance.LogError("BoosterCardTooltip: 创建悬浮框失败 - " + ex.Message);
                tooltipRoot = null;
            }
        }

        private static void PositionTooltip()
        {
            if (tooltipRoot == null) return;

            var rect = tooltipRoot.GetComponent<RectTransform>();

            // 开包场景卡牌在屏幕中央偏左，悬浮框放在卡牌右侧紧贴
            // anchor 设为 (0.58, 0.5)，即屏幕中心偏右，离卡牌近
            rect.anchorMin = new Vector2(0.58f, 0.5f);
            rect.anchorMax = new Vector2(0.58f, 0.5f);
            rect.pivot = new Vector2(0f, 0.5f);
            rect.anchoredPosition = new Vector2(10f, 0f);
        }

        private static void HideBoosterTooltip()
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

            foreach (var canvas in canvases)
            {
                if (canvas != null && canvas.gameObject.activeInHierarchy
                    && canvas.renderMode == RenderMode.ScreenSpaceOverlay)
                {
                    return canvas.gameObject;
                }
            }

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
