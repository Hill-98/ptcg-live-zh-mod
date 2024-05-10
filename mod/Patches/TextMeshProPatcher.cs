using HarmonyLib;
using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;

namespace PTCGLiveZhMod.Patches
{
    internal static class TextMeshProPatcher
    {
        static readonly Dictionary<string, object> Assets = new Dictionary<string, object>();

        static readonly string[] EffectTextNames = new[] { "TierText", "StatName" };

        /// <summary>
        /// 强制修改 TextMeshPro 字体
        /// </summary>
        [HarmonyPatch(typeof(TextMeshPro), nameof(TextMeshPro.SetLayoutDirty))]
        [HarmonyPatch(typeof(TextMeshPro), nameof(TextMeshPro.SetMaterialDirty))]
        [HarmonyPrefix]
        static void TextMeshPro_LoadFontAssetPrefix(TextMeshPro __instance)
        {
            try
            {
                if (LoadFontAssets())
                {
                    __instance.font = Assets["font-alt"] as TMP_FontAsset;
                    __instance.fontSharedMaterial = Assets["material-alt"] as Material;
                }
            }
            catch (Exception ex)
            {
                Plugin.LoggerInstance.LogError(ex);
            }
        }

        /// <summary>
        /// 强制修改 TextMeshProUGUI 字体
        /// </summary>
        [HarmonyPatch(typeof(TextMeshProUGUI), nameof(TextMeshProUGUI.SetLayoutDirty))]
        [HarmonyPatch(typeof(TextMeshProUGUI), nameof(TextMeshProUGUI.SetMaterialDirty))]
        [HarmonyPrefix]
        static void TextMeshProUGUI_LoadFontAssetPrefix(TextMeshProUGUI __instance)
        {
            try
            {
                if (LoadFontAssets())
                {
                    __instance.font = Assets["font"] as TMP_FontAsset;
                    __instance.fontSharedMaterial = Assets["material"] as Material;
                }

                if (__instance.color != Color.black && EffectTextNames.Contains(__instance.name))
                {
                    __instance.color = Color.black;
                }

                if (__instance.overflowMode != TextOverflowModes.Overflow && __instance.preferredWidth > 1 && __instance.bounds.extents == Vector3.zero)
                {
                    __instance.overflowMode = TextOverflowModes.Overflow;
                }
            }
            catch (Exception ex)
            {
                Plugin.LoggerInstance.LogError(ex);
            }
        }

        static bool LoadFontAssets()
        {
            if (!Assets.TryGetValue("font", out var _) || !Assets.TryGetValue("material", out var _))
            {
                AssetBundleManagerX.LoadFontAssets(out var font, out var material);
                if (font == null || material == null)
                {
                    return false;
                }
                Assets.Add("font", font);
                Assets.Add("material", material);
            }

            if (!Assets.TryGetValue("font-alt", out var _) || !Assets.TryGetValue("material-alt", out var _))
            {
                AssetBundleManagerX.LoadFontAssetsAlt(out var font, out var material);
                if (font == null || material == null)
                {
                    return false;
                }
                Assets.Add("font-alt", font);
                Assets.Add("material-alt", material);
            }
            return true;
        }
    }
}
