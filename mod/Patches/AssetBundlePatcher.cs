using HarmonyLib;
using System.Collections.Generic;
using TPCI.AssetBundleSystem;

namespace PTCGLiveZhMod.Patches
{
    internal static class AssetBundlePatcher
    {
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
