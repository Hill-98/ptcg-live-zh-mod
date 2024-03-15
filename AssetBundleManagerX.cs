using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using TMPro;
using UnityEngine;

namespace PTCGLiveZhMod
{
    class AssetBundleManagerX
    {
        static readonly Dictionary<string, AssetBundle> LoadedBundles = new Dictionary<string, AssetBundle>();

        public static AssetBundle LoadAssetBundle(string bundleName)
        {
            if (LoadedBundles.ContainsKey(bundleName))
            {
                return LoadedBundles[bundleName];
            }
            var bundlePath = Path.Combine(Plugin.AssetsDirectory, bundleName);
            if (File.Exists(bundlePath))
            {
                try
                {
                    var bundle = AssetBundle.LoadFromFile(bundlePath);
                    LoadedBundles[bundleName] = bundle;
                    return bundle;
                }
                catch (Exception ex)
                {
                    Plugin.LoggerInstance.LogError(ex);
                    return null;
                }
            }
            return null;
        }

        public static bool LoadFontAsset(out TMP_FontAsset font, out Material material)
        {
            font = null;
            material = null;

            if (!LoadedBundles.ContainsKey("arialuni"))
            {
                try
                {
                    LoadedBundles.Add("arialuni", AssetBundle.LoadFromFile(Path.Combine(Plugin.FontsDirectory, "arialuni_sdf_u2019")));
                }
                catch (Exception ex)
                {
                    Plugin.LoggerInstance.LogError(ex);
                    return false;
                }
            }

            var bundle = LoadedBundles["arialuni"];
            try
            {
                font = bundle.LoadAsset<TMP_FontAsset>("assets/arialuni sdf.asset");
                material = bundle.LoadAsset<Material>("assets/arialuni sdf.asset");
            }
            catch (Exception ex)
            {
                Plugin.LoggerInstance.LogError(ex);
                return false;
            }

            return true;
        }
    }
}
