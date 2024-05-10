using HarmonyLib;
using TPCI.Build;
using TPCI.Localization;

namespace PTCGLiveZhMod.Patches
{
    internal static class LocalizationPatcher
    {
        /// <summary>
        /// 尝试获取并返回已翻译文本 (开始界面)
        /// </summary>
        [HarmonyPatch(typeof(StartupLocalization), nameof(StartupLocalization.GetString))]
        [HarmonyPrefix]
        static bool StartupLocalization_GetStringPrefix(StartupLocalization __instance, ref string __result, out bool __state, string locID)
        {
            if (Configuration.DumpAllLocalizationText.Value)
            {
                foreach (var item in __instance.locValues)
                {
                    Plugin.AddUntranslatedText(item.locID, item.en);
                }
            }

            __state = Plugin.GetLocText(locID, out var text);
            if (__state)
            {
                __result = text;
            }
            return !__state;
        }

        /// <summary>
        /// 保存未翻译文本 (开始界面)
        /// </summary>
        [HarmonyPatch(typeof(StartupLocalization), nameof(StartupLocalization.GetString))]
        [HarmonyPostfix]
        static void StartupLocalization_GetStringPostfix(ref string __result, bool __state, string locID)
        {
            if (Configuration.DumpUntranslatedText.Value && !__state)
            {
                Plugin.AddUntranslatedText(locID, __result);
            }
        }

        /// <summary>
        /// 尝试获取并返回已翻译文本
        /// </summary>
        [HarmonyPatch(typeof(LocalizationManager), nameof(LocalizationManager.TryGetString))]
        [HarmonyPrefix]
        static bool LocalizationManager_TryGetStringPrefix(ref bool __result, out bool __state, LocalizationData ____loadedLocTable, string resourceID, out string value)
        {
            if (Configuration.DumpAllLocalizationText.Value)
            {
                foreach (var item in ____loadedLocTable.locTable)
                {
                    Plugin.AddUntranslatedText(item.Key, item.Value);
                }
            }

            __state = Plugin.GetLocText(resourceID, out value);
            __result = __state;
            return !__state;
        }

        /// <summary>
        /// 保存未翻译文本
        /// </summary>
        [HarmonyPatch(typeof(LocalizationManager), nameof(LocalizationManager.TryGetString))]
        [HarmonyPostfix]
        static void LocalizationManager_TryGetStringPostfix(bool __result, bool __state, string resourceID, string value)
        {
            if (Configuration.DumpUntranslatedText.Value && __result && !__state)
            {
                Plugin.AddUntranslatedText(resourceID, value);
            }
        }

        /// <summary>
        /// 添加中文化模组作者&版权相关信息
        /// </summary>
        [HarmonyPatch(typeof(GameVersionInfo), nameof(GameVersionInfo.GetGameVersion))]
        [HarmonyPostfix]
        static void GameVersionInfo_GetGameVersionPostfix(ref string __result)
        {
            __result = __result + "\n" + "中文化模组由 Hill-98 (小山) 制作";
            if (Plugin.AssetsProvidedByKuyo)
            {
                __result = __result + " & 中文化卡牌图片资源由 Kuyo 提供";
            }
        }
    }
}
