using HarmonyLib;
using System;
using System.Collections.Generic;
using TMPro;
using TPCI.AssetBundleSystem;
using TPCI.Localization;
using TPCI.CardShaders;
using TPCI.Build;
using UnityEngine;
using CardDatabase.DataAccess;
using SharedLogicUtils.source.CardData;
using System.Data;

namespace PTCGLiveZhMod
{
    class Patcher
    {
        /// <summary>
        /// 替换卡牌缩略图为常规卡牌图片以实现缩略图中文化
        /// </summary>
        [HarmonyPatch(typeof(AssetBundle), nameof(AssetBundle.LoadAssetAsync), new Type[] { typeof(string), typeof(Type) })]
        [HarmonyPrefix]
        static bool AssetBundle_LoadAssetAsyncPrefix(ref AssetBundleRequest __result, string name)
        {
            if (name.EndsWith("_t"))
            {
                var bundleName = name.Substring(0, name.Length - 2);
                var bundle = AssetBundleManagerX.LoadAssetBundle(bundleName);
                if (bundle != null)
                {
                    var assetNames = bundle.GetAllAssetNames();
                    var manifest = bundle.LoadAsset<TPCICardMaterialManifest>("MaterialManifest");
                    foreach (var assetName in assetNames)
                    {
                        if (assetName.EndsWith("/" + manifest.ColorTexture + ".png"))
                        {
                            __result = bundle.LoadAssetAsync(assetName);
                            return false;
                        }
                    }
                }
            }
            return true;
        }

        /// <summary>
        /// 替换中文化资产包
        /// </summary>
        [HarmonyPatch(typeof(AssetBundleManager), "DownloadOrLoadFromCacheBundle")]
        [HarmonyPrefix]
        static bool AssetBundleManager_DownloadOrLoadFromCacheBundlePrefix(ref System.Collections.IEnumerator __result ,Dictionary<string, AssetBundleObject> ___loadedBundles, AssetBundleObject bundleInfo)
        {
            var name = bundleInfo.bundleName;
            var bundle = AssetBundleManagerX.LoadAssetBundle(name);
            if (bundle != null)
            {
                bundleInfo.SetAssetBundle(bundle);
                if (!___loadedBundles.ContainsKey(name))
                {
                    ___loadedBundles.Add(name, bundleInfo);
                }
                __result = Helper.YieldBreak();
                return false;
            }
            return true;
        }

        [HarmonyPatch(typeof(ConfigCardDataTablesProvider), nameof(ConfigCardDataTablesProvider.GetCardDataTables))]
        [HarmonyPostfix]
        static void QueryableCardDataTablesRepository_tablesLookupSeterPostfix(IEnumerable<CardDataTable> ___dataTables)
        {
            foreach (var item in ___dataTables)
            {
                foreach (DataRow row in item.SourceDataTable.Rows)
                {
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

        /// <summary>
        /// 添加中文化模组作者&版权相关信息
        /// </summary>
        [HarmonyPatch(typeof(GameVersionInfo), nameof(GameVersionInfo.GetGameVersion))]
        [HarmonyPostfix]
        static void GameVersionInfo_GetGameVersionPostfix(ref string __result)
        {
            __result = __result + "\n" + "中文化模组由 Hill-98 (小山) 提供 & 中文化卡牌资源由 Kuyo 提供";
        }

        /// <summary>
        /// 尝试获取并返回中文文本 (开始界面)
        /// </summary>
        [HarmonyPatch(typeof(StartupLocalization), nameof(StartupLocalization.GetString))]
        [HarmonyPrefix]
        static bool StartupLocalization_GetStringPrefix(ref string __result, out bool __state, string locID)
        {
            __state = Plugin.GetLocText(locID, out var text);
            if (__state) {
                __result = text;
            }
            return !__state;
        }

        /// <summary>
        /// 保存未汉化文本 (开始界面)
        /// </summary>
        [HarmonyPatch(typeof(StartupLocalization), nameof(StartupLocalization.GetString))]
        [HarmonyPostfix]
        static void StartupLocalization_GetStringPostfix(ref string __result, bool __state, string locID)
        {
            if (!__state)
            {
                Plugin.AddUntranslatedText(locID, __result);
            }
        }

        /// <summary>
        /// 尝试获取并返回中文文本
        /// </summary>
        [HarmonyPatch(typeof(LocalizationManager), nameof(LocalizationManager.TryGetString))]
        [HarmonyPrefix]
        static bool LocalizationManager_TryGetStringPrefix(ref bool __result, out bool __state, string resourceID, out string value)
        {
            __state = Plugin.GetLocText(resourceID, out value);
            __result = __state;
            return !__state;
        }

        /// <summary>
        /// 保存未汉化文本
        /// </summary>
        [HarmonyPatch(typeof(LocalizationManager), nameof(LocalizationManager.TryGetString))]
        [HarmonyPostfix]
        static void LocalizationManager_TryGetStringPostfix(bool __result, bool __state, string resourceID, string value)
        {
            if (__result && !__state) {
                Plugin.AddUntranslatedText(resourceID, value);
            }
        }

        /// <summary>
        /// 强制修改 TextMeshPro 字体以及修复替换字体后的怪癖
        /// </summary>
        [HarmonyPatch(typeof(TextMeshProUGUI), nameof(TextMeshProUGUI.SetLayoutDirty))]
        [HarmonyPatch(typeof(TextMeshProUGUI), nameof(TextMeshProUGUI.SetMaterialDirty))]
        [HarmonyPrefix]
        static void TextMeshProUGUI_SetMaterialDirtyPrefix(TextMeshProUGUI __instance)
        {
            if (!AssetBundleManagerX.LoadFontAsset(out var font, out var material))
            {
                return;
            }

            __instance.font = font;
            __instance.fontSharedMaterial = material;

            // 修复替换字体后的怪癖
            if (__instance.name == "Text" && __instance.transform.parent.transform.parent.gameObject.name == "DeckButton") // Home 界面右下角 Decks 字样
            {
                __instance.autoSizeTextContainer = true;
                __instance.fontSizeMax = 36;
                __instance.alignment = TextAlignmentOptions.Bottom;
            } else if (__instance.name == "DeckTitleText") // Decks 界面右侧 Deck 标题
            {
                __instance.fontSize = 34;
            } else if (__instance.name == "Title" && __instance.transform.parent.gameObject.name == "DeckTitle") // Decks 界面左侧 Deck 标题
            {
                __instance.fontSize = 28;
            }
        }
    }
}
