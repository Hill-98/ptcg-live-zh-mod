using CardDatabase.DataAccess;
using HarmonyLib;
using SharedLogicUtils.source.CardData;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text.RegularExpressions;

namespace PTCGLiveZhMod.Patches
{
    internal static class CardDatabasePatcher
    {
        /// <summary>
        /// 修复本地化后的卡牌名称无法显示特效 (ex)
        /// </summary>
        [HarmonyPatch(typeof(CardDataRowRichTextTransformer), "ReplaceExLowerInCardNameWithSpriteTag")]
        [HarmonyPrefix]
        static void CardDataRowRichTextTransformer_ReplaceExLowerInCardNameWithSpriteTagPrefix(ref string input)
        {
            input = Regex.Replace(input, "-?ex$", " ex");

        }

        /// <summary>
        /// 修复本地化后的卡牌名称无法显示特效 (V)
        /// </summary>
        [HarmonyPatch(typeof(CardDataRowRichTextTransformer), "ReplaceVInCardNameWithSpriteTag")]
        [HarmonyPrefix]
        static void CardDataRowRichTextTransformer_ReplaceVInCardNameWithSpriteTagPrefix(ref string richText)
        {
            richText = Regex.Replace(richText, "V$", " V");
        }

        /// <summary>
        /// 本地化卡牌数据库
        /// </summary>
        [HarmonyPatch(typeof(ConfigCardDataTablesProvider), nameof(ConfigCardDataTablesProvider.GetCardDataTables))]
        [HarmonyPostfix]
        static void ConfigCardDataTablesProvider_GetCardDataTablesPostfix(IEnumerable<CardDataTable> ___dataTables)
        {
            foreach (var table in ___dataTables)
            {
                foreach (DataRow row in table.SourceDataTable.Rows)
                {
                    if (Configuration.DumpAllCards.Value)
                    {
                        try
                        {
                            Plugin.DumpCard(row);
                        }
                        catch (Exception ex)
                        {
                            Plugin.LoggerInstance.LogError(ex);
                        }
                    }

                    try
                    {
                        Plugin.LocCard(row);
                    }
                    catch (Exception ex)
                    {
                        Plugin.LoggerInstance.LogError(ex);
                    }
                }
            }
        }
    }
}
