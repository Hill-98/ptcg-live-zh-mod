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
        [HarmonyPatch(typeof(AssetBundleManager), nameof(AssetBundleManager.LoadAssetBundle), new Type[] { typeof(LoadParams) })]
        [HarmonyPrefix]
        static bool AssetBundleManager_DownloadOrLoadFromCacheBundlePrefix(ref System.Collections.IEnumerator __result, Dictionary<string, AssetBundleObject> ___availableBundles, Dictionary<string, AssetBundleObject> ___loadedBundles, LoadParams loadParams)
        {
            var name = loadParams.bundleName;
            var bundle = AssetBundleManagerX.LoadAssetBundle(name);
            if (bundle != null)
            {
                AssetBundleObject bundleInfo = ___availableBundles[name];
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
    }
}
