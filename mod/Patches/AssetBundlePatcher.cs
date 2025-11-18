using HarmonyLib;
using System;
using System.Collections.Generic;
using TPCI.AssetBundleSystem;
using TPCI.CardShaders;
using UnityEngine;
using static TPCI.AssetBundleSystem.AssetBundleManager;

namespace PTCGLiveZhMod.Patches
{
    internal static class AssetBundlePatcher
    {
        /// <summary>
        /// 替换卡牌缩略图为常规卡牌图片以实现缩略图本地化
        /// </summary>
        [HarmonyPatch(typeof(AssetBundle), nameof(AssetBundle.LoadAssetAsync), new Type[] { typeof(string), typeof(Type) })]
        [HarmonyPrefix]
        static bool AssetBundle_LoadAssetAsyncPrefix(ref AssetBundleRequest __result, string name, Type type)
        {
            if (name.EndsWith("_t") && type == typeof(Texture2D))
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
        /// 替换本地化资产包
        /// </summary>
        [HarmonyPatch(typeof(AssetBundleManager), "DownloadOrLoadFromCacheBundle")]
        [HarmonyPrefix]
        static bool AssetBundleManager_DownloadOrLoadFromCacheBundlePrefix(ref System.Collections.IEnumerator __result, Dictionary<string, AssetBundleObject> ___loadedBundles, AssetBundleObject bundleInfo)
        {
            var name = bundleInfo.LocalizedBundleName;
            var bundle = AssetBundleManagerX.LoadAssetBundle(name);
            if (bundle != null)
            {
                ___loadedBundles.Add(bundleInfo.LocalizedBundleName, bundleInfo);
                bundleInfo.isLoading = false;
                bundleInfo.SetAssetBundle(bundle);
                __result = Helper.YieldBreak();
                return false;
            }
            return true;
        }
    }
}
