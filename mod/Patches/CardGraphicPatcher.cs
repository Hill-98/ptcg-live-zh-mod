using System.Collections;
using CardDatabase.DataAccess.CardFormat;
using HarmonyLib;
using TMPro;
using TPCI.Rainier.Match.Cards;
using UnityEngine;

namespace PTCGLiveZhMod.Patches
{
    internal static class CardGraphicPatcher
    {
        static bool IsBattleStadiumCard(BattleMenu obj, Card3DGraphic card)
        {
            if (card == null)
            {
                return false;
            }
            return obj is StackCardOverlay && card.dataRow.CardFormatFlags.HasFlag(FormatFlagsProvider.Default.Stadium);
        }

        static bool IsPokemonAttachCard(BattleMenu obj, Card3DGraphic card)
        {
            if (!(obj is StackCardOverlay) || card == null)
            {
                return false;
            }
            var grabbedCard = AccessTools.Field(typeof(StackCardOverlay), "grabbedCard").GetValue(obj) as Card3D;
            if (grabbedCard != null)
            {
                var attachCards = grabbedCard.GetOwnedCards();
                foreach (var item in attachCards)
                {
                    var row = item.cardDataRow;
                    if (item.cardDataRow.CardID == card.CardId && (row.IsTrainerCard() || row.IsSpecialEnergy()))
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        static bool IsTargetBattleMenu(BattleMenu obj, Card3DGraphic card)
        {
            // BigCardMenu 手牌
            // CardInspectionMenu 弃牌区，检索卡牌等
            return obj is BigCardMenu
                || obj is CardInspectionMenu
                || IsBattleStadiumCard(obj, card)
                || IsPokemonAttachCard(obj, card);

        }

        [HarmonyPatch(typeof(BattleMenu), nameof(BattleMenu.Open))]
        [HarmonyPatch(typeof(BattleMenu), "OnOpen")]
        [HarmonyPostfix]
        static void BattleMenu_OpenPostfix(BattleMenu __instance)
        {
            var cards = __instance.gameObject.GetComponentsInChildren<Card3DGraphic>();
            foreach (var card in cards)
            {
                if (IsTargetBattleMenu(__instance, card))
                {
                    __instance.StartCoroutine(Card3DGraphic_LoadTextVersion(card));
                }
            }
            if (__instance is BigCardUIMenu)
            {
                var card = AccessTools.Field(typeof(BigCardUIMenu), "_currentCard").GetValue(__instance) as CardUI;
                if (card != null)
                {
                    __instance.StartCoroutine(CardUI_LoadTextVersion(card));
                }
            }
        }

        [HarmonyPatch(typeof(BattleMenu), nameof(BattleMenu.Close))]
        [HarmonyPatch(typeof(BattleMenu), "OnClose")]
        [HarmonyPatch(typeof(BattleMenu), "OnReturn")]
        [HarmonyPrefix]
        static void BattleMenu_ClosePostfix(BattleMenu __instance)
        {
            var cards = __instance.gameObject.GetComponentsInChildren<Card3DGraphic>();
            foreach (var card in cards)
            {
                if (IsTargetBattleMenu(__instance, card))
                {
                    card.HideText();
                }
            }
            if (__instance is BigCardUIMenu)
            {
                var card = AccessTools.Field(typeof(BigCardUIMenu), "_currentCard").GetValue(__instance) as CardUI;
                if (card != null)
                {
                    var tmp = AccessTools.Field(typeof(CardUI), "tempCardText").GetValue(card) as TextMeshProUGUI;
                    tmp?.gameObject.SetActive(false);
                }
            }
        }

        /// <summary>
        /// 延迟显示文本辅助方法 (Card3DGraphic)
        /// </summary>
        static IEnumerator Card3DGraphic_LoadTextVersion(Card3DGraphic card)
        {
            yield return new WaitForSeconds(0.3f);
            AccessTools.Method(typeof(Card3DGraphic), "LoadTextVersion").Invoke(card, new object[0]);
            yield return null;
        }

        /// <summary>
        /// 延迟显示文本辅助方法 (CardUI)
        /// </summary>
        static IEnumerator CardUI_LoadTextVersion(CardUI card)
        {
            yield return new WaitForSeconds(0.3f);
            AccessTools.Method(typeof(CardUI), "LoadTextVersion").Invoke(card, new object[0]);
            yield return null;
        }

        /// <summary>
        /// 允许 Card3DGraphic 显示文本
        /// </summary>
        [HarmonyPatch(typeof(Card3DGraphic), "LoadTextVersion")]
        [HarmonyPrefix]
        static void Card3DGraphic_LoadTextVersionPrefix(ref bool ___showText)
        {
            ___showText = true;
        }

        /// <summary>
        /// 设置对局中大多数卡牌大图的文字版本效果
        /// </summary>
        [HarmonyPatch(typeof(Card3DGraphic), "LoadTextVersion")]
        [HarmonyPostfix]
        static void Card3DGraphic_LoadTextVersionPostfix(Card3DGraphic __instance, GameObject ___textVersionHolder)
        {
            if (___textVersionHolder == null)
            {
                return;
            }

            var overlay = __instance.gameObject.GetComponentInParent<StackCardOverlay>();
            var pos = ___textVersionHolder.transform.localPosition;
            var isBattleStadium = IsBattleStadiumCard(overlay, __instance);
            var isPokemonAttach = IsPokemonAttachCard(overlay, __instance);
            if (overlay != null && (isBattleStadium || isPokemonAttach))
            {
                if (isPokemonAttach)
                {
                    ___textVersionHolder.transform.localPosition = new Vector3(0, pos.y, 1);
                }
            } else
            {
                ___textVersionHolder.transform.localPosition = new Vector3(8, pos.y, pos.z);
            }
        }

        /// <summary>
        /// 强制 Card3DGraphic 文本版本显示详细信息
        /// </summary>
        [HarmonyPatch(typeof(CardTextOverlayParts), nameof(CardTextOverlayParts.SetDetailedText))]
        [HarmonyPrefix]
        static void CardTextOverlayParts_SetDetailedTextPrefix(ref bool detailed)
        {
            detailed = true;
        }

        /// <summary>
        /// 设置 Card3DGraphic 文本版本样式
        /// </summary>
        [HarmonyPatch(typeof(CardTextOverlayParts), nameof(CardTextOverlayParts.SetDetailedText))]
        [HarmonyPostfix]
        static void CardTextOverlayParts_SetDetailedTextPostfix(TextMeshPro ___cardInfoText)
        {
            ___cardInfoText.color = Color.green;
            ___cardInfoText.fontStyle = FontStyles.Bold;
        }

        /// <summary>
        /// 禁止 CardUI 自动隐藏文本
        /// </summary>
        /// <param name="___tempCardText"></param>
        [HarmonyPatch(typeof(CardUI), "LoadAssetBundle")]
        [HarmonyPostfix]
        static void CardUI_LoadAssetBundlePostfix(TextMeshProUGUI ___tempCardText)
        {
            if (___tempCardText.color == Color.green)
            {
                ___tempCardText.gameObject.SetActive(true);
            }
        }

        /// <summary>
        /// 设置 CardUI (调度卡牌 & 战斗日志卡牌) 文本版本
        /// </summary>
        [HarmonyPatch(typeof(CardUI), "LoadTextVersion")]
        [HarmonyPostfix]
        static void CardUI_LoadTextVersionPostfix(Card3DGraphic __instance, TextMeshProUGUI ___tempCardText)
        {
            ___tempCardText.color = Color.green;
            ___tempCardText.fontSize = 40;
            ___tempCardText.fontStyle = FontStyles.Bold;
            ___tempCardText.text = __instance.dataRow.LocalizedCardName + "\n\n";
            for (var i = 0; i < 4; i++)
            {
                var actionName = __instance.dataRow.GetEnglishActionName(i).Replace("[Ability]", "【特性】");
                var actionText = __instance.dataRow.GetEnglishActionText(i);
                if (!string.IsNullOrEmpty(actionText) && actionText.Contains("\n"))
                {
                    var actionTextLines = actionText.Split('\n');
                    actionText = "";
                    foreach (var line in actionTextLines)
                    {
                        if (!string.IsNullOrEmpty(line.Trim()))
                        {
                            actionText += line + "\n";
                        };
                    }
                    actionText = actionText.Trim();
                }
                ___tempCardText.text += actionName + "\n" + actionText + "\n\n";
            }
            ___tempCardText.text = ___tempCardText.text.Trim();
            ___tempCardText.gameObject.SetActive(true);
        }

        /// <summary>
        /// 牌库卡牌展示时调用 ShowLoadingText
        /// </summary>
        /// <param name="__instance"></param>
        [HarmonyPatch(typeof(CardCountStackParts), nameof(CardCountStackParts.Setup))]
        [HarmonyPostfix]
        static void CardCountStackParts_SetupPostfix(CardCountStackParts __instance)
        {
            AccessTools.Method(typeof(CardCountStackParts), "ShowLoadingText").Invoke(__instance, new object[] { null });
        }

        /// <summary>
        /// 禁止自动隐藏牌库卡牌右侧文本
        /// </summary>
        [HarmonyPatch(typeof(CardCountStackParts), "HideLoadingText")]
        [HarmonyPrefix]
        static bool CardCountStackParts_HideLoadingTextPrefix()
        {
            return false;
        }

        /// <summary>
        /// 设置牌库卡牌右侧文本
        /// </summary>
        [HarmonyPatch(typeof(CardCountStackParts), "ShowLoadingText")]
        [HarmonyPostfix]
        static void CardCountStackParts_ShowLoadingTextPostfix(CardCountStackParts __instance, TextMeshProUGUI ___cardInfoText, TextMeshProUGUI ___cardNameText)
        {
            var card = __instance.StoredCard;
            if (card == null || ___cardInfoText == null || ___cardNameText == null)
            {
                return;
            }
            var isOverlayCanvasFullCard = false;
            var parent = __instance.transform?.parent;
            Transform rarityDisplayGroupLandscape = null;
            while (parent != null)
            {
                if (parent.name == "RarityDisplayGroup_Landscape")
                {
                    rarityDisplayGroupLandscape = parent;
                }
                if (parent.name == "OverlayCanvas_FullCard")
                {
                    isOverlayCanvasFullCard = true;
                    break;
                }
                parent = parent.parent;
            }
            var infoPos = ___cardInfoText.transform.localPosition;
            var namePos = ___cardNameText.transform.localPosition;
            if (isOverlayCanvasFullCard)
            {
                ___cardInfoText.transform.localPosition = new Vector3(-710, infoPos.y, infoPos.z);
                ___cardNameText.transform.localPosition = new Vector3(-740, namePos.y, namePos.z);
            }
            else
            {
                rarityDisplayGroupLandscape?.SetSiblingIndex(1);
                ___cardInfoText.transform.localPosition = new Vector3(-770, infoPos.y, infoPos.z);
                ___cardNameText.transform.localPosition = new Vector3(-800, namePos.y, namePos.z);
            }
            ___cardInfoText.color = Color.green;
            ___cardInfoText.fontSize = 40;
            ___cardInfoText.fontStyle = FontStyles.Bold;
            ___cardInfoText.text = "<b>";
            ___cardNameText.color = Color.green;
            ___cardNameText.fontSize = 40;
            ___cardNameText.fontStyle = FontStyles.Bold;
            ___cardNameText.text = $"<b>{card.LocalizedCardName}</b>";
            for (var i = 0; i < 4; i++)
            {
                var actionName = card.GetEnglishActionName(i).Replace("[Ability]", "【特性】");
                var actionText = card.GetEnglishActionText(i);
                if (!string.IsNullOrEmpty(actionText) && actionText.Contains("\n"))
                {
                    var actionTextLines = actionText.Split('\n');
                    actionText = "";
                    foreach (var line in actionTextLines)
                    {
                        if (!string.IsNullOrEmpty(line.Trim()))
                        {
                            actionText += line + "\n";
                        };
                    }
                    actionText = actionText.Trim();
                }
                ___cardInfoText.text += actionName + "\n" + actionText + "\n\n";
            }
            ___cardInfoText.text = ___cardInfoText.text.Trim() + "</b>";
        }
    }
}
