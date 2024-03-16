using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Threading.Tasks;

namespace PTCGLiveZhMod
{
    [BepInPlugin("c04dfa3f-14f5-40b8-9f63-1d2d13b29bb3", "ptcg-live-zh-mod", "0.1.1")]
    public class Plugin : BaseUnityPlugin
    {
        public static string BaseDirectory { get { return baseDirectory; } }

        public static string AssetsDirectory { get { return Path.Combine(BaseDirectory, "assets"); } }

        public static string CardsDirectory { get { return Path.Combine(BaseDirectory, "cards"); } }

        public static string DatabasesDirectory { get { return Path.Combine(BaseDirectory, "databases"); } }

        public static string FontsDirectory { get { return Path.Combine(BaseDirectory, "fonts"); } }

        public static string TextDirectory { get { return Path.Combine(BaseDirectory, "text"); } }

        public static Plugin Instance { get { return _instance; } }

        public static ManualLogSource LoggerInstance { get { return _instance.Logger; } }

        private static Plugin _instance { get; set; }

        private static string baseDirectory { get; set; }

        private static readonly Dictionary<string, string> locTextTable = new Dictionary<string, string>();

        private static readonly Dictionary<string, string> namesDatabase = new Dictionary<string, string>();

        private static string untranslatedTextFile { get { return Path.Combine(BaseDirectory, "untranslated.txt"); } }

        private static readonly Dictionary<string, string> untranslatedTextTable = new Dictionary<string, string>();

        private void Awake()
        {
            _instance = this;
            baseDirectory = Path.GetDirectoryName(Info.Location);

            if (Directory.Exists(TextDirectory)) {
                var locTextFiles = Directory.GetFiles(TextDirectory, "*.txt");
                foreach (var file in locTextFiles)
                {
                    LoadLocFile(file, locTextTable);
                }
            }

            LoadLocFile(Path.Combine(DatabasesDirectory, "names.txt"), namesDatabase);
            LoadLocFile(untranslatedTextFile, untranslatedTextTable);

            try
            {
                var asmNamePather = Harmony.CreateAndPatchAll(typeof(AssemblyNamePatcher));
                Harmony.CreateAndPatchAll(typeof(Patcher));
                asmNamePather.UnpatchSelf();
            }
            catch (Exception ex)
            {
                Logger.LogError(ex);
            }
        }

        public static void AddUntranslatedText(string key, string text)
        {
            if (untranslatedTextTable.ContainsKey(key))
            {
                return;
            }
            try
            {
                File.AppendAllText(untranslatedTextFile, $"{key}:{text}\n");
                untranslatedTextTable.Add(key, text);
            }
            catch (Exception ex)
            {
                LoggerInstance.LogError(ex);
            }
        }

        public static void DumpCard(DataRow row)
        {
            var id = (string)row["cardID"];
            var file = Path.Combine(CardsDirectory, id + ".txt");
            if (!Directory.Exists(CardsDirectory))
            {
                Directory.CreateDirectory(CardsDirectory);
            }
            if (File.Exists(file))
            {
                File.Delete(file);
            }
            var text = "";
            foreach (DataColumn cell in row.Table.Columns)
            {
                text += cell.ColumnName + ":" + row[cell].ToString() + "\n";
            }
            Task.Run(() =>
            {
                File.WriteAllText(file, text);
            }).Start();
        }

        public static bool GetLocText(string key, out string text)
        {
            text = string.Empty;
            if (string.IsNullOrEmpty(key?.Trim()))
            {
                return false;
            }
            return locTextTable.TryGetValue(key, out text);
        }

        public static void LocCard(DataRow row)
        {
            if (namesDatabase.TryGetValue(Helper.md5sum(row["LocalizedCardName"].ToString()), out var name))
            {
                row["LocalizedCardName"] = name;
            }
        }

        public static void LoadLocFile(string file, Dictionary<string, string> dict)
        {
            if (!File.Exists(file))
            {
                return;
            }
            try
            {
                var lines = File.ReadAllLines(file);
                foreach (var line in lines)
                {
                    var i = line.IndexOf(':');
                    if (i <= 0 || line.StartsWith("#"))
                    {
                        continue;
                    }
                    var key = line.Substring(0, i);
                    var text = line.Substring(i + 1);
                    if (!dict.ContainsKey(key))
                    {
                        dict.Add(key.Trim(), text.Trim());
                    }
                }
            }
            catch (Exception ex)
            {
                LoggerInstance.LogError(ex);
            }
        }
    }
}
