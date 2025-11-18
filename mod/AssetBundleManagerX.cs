using System;
using System.Collections.Generic;
using System.IO;
using TMPro;
using UnityEngine;

namespace PTCGLiveZhMod
{
    internal static class AssetBundleManagerX
    {
        static readonly string FontBundleName = "NotoSansSC";

        static readonly Dictionary<string, AssetBundle> LoadedBundles = new Dictionary<string, AssetBundle>();

        public static AssetBundle LoadAssetBundle(string bundleName)
        {
            if (LoadedBundles.TryGetValue(bundleName, out AssetBundle bundle) && bundle != null)
            {
                if (bundle != null)
                {
                    return bundle;
                }
            }
            var bundlePath = Path.Combine(Plugin.AssetsDirectory, bundleName);
            if (File.Exists(bundlePath))
            {
                try
                {
                    var __bundle = AssetBundle.LoadFromFile(bundlePath);
                    LoadedBundles[bundleName] = __bundle;
                    return __bundle;
                }
                catch (Exception ex)
                {
                    Plugin.LoggerInstance.LogError(ex);
                    return null;
                }
            }
            return null;
        }

        public static bool LoadFontAssets(out TMP_FontAsset font, out Material material)
        {
            font = null;
            material = null;

            var bundle = LoadFontBundle();
            try
            {
                font = bundle.LoadAsset<TMP_FontAsset>("assets/notosanscjksc-regular sdfop.asset");
                material = bundle.LoadAsset<Material>("assets/notosanscjksc-regular sdfop.asset");
            }
            catch (Exception ex)
            {
                Plugin.LoggerInstance.LogError(ex);
                return false;
            }

            return font != null && material != null;
        }

        public static bool LoadFontAssetsAlt(out TMP_FontAsset font, out Material material)
        {
            font = null;
            material = null;

            var bundle = LoadFontBundle();
            try
            {
                font = bundle.LoadAsset<TMP_FontAsset>("assets/notosanscjksc-regular sdfop_alt.asset");
                material = bundle.LoadAsset<Material>("assets/notosanscjksc-regular sdfop_alt.asset");
            }
            catch (Exception ex)
            {
                Plugin.LoggerInstance.LogError(ex);
                return false;
            }

            return font != null && material != null;
        }

        public static AssetBundle LoadFontBundle()
        {
            AssetBundle bundle;
            if (!LoadedBundles.TryGetValue(FontBundleName, out bundle))
            {
                try
                {
                    bundle = AssetBundle.LoadFromFile(Path.Combine(Plugin.FontsDirectory, "NotoSansSC_sdf32_optimized_12k_lzma_2019"));
                    LoadedBundles.Add(FontBundleName, bundle);
                }
                catch (Exception ex)
                {
                    Plugin.LoggerInstance.LogError(ex);
                    return null;
                }
            }
            return bundle;
        }
    }
}
