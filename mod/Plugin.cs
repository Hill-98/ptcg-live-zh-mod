using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using PTCGLiveZhMod.Patches;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Threading.Tasks;

namespace PTCGLiveZhMod
{
    [BepInPlugin("c04dfa3f-14f5-40b8-9f63-1d2d13b29bb3", "ptcg-live-zh-mod", "0.2.0")]
    public class Plugin : BaseUnityPlugin
    {
        public static string BaseDirectory { get { return Path.GetDirectoryName(Instance.Info.Location); } }

        public static string AssetsDirectory { get { return Path.Combine(BaseDirectory, "assets"); } }

        public static bool AssetsProvidedByKuyo { get { return File.Exists(Path.Combine(AssetsDirectory, "kuyo.provided")); } }

        public static string CardsDirectory { get { return Path.Combine(BaseDirectory, "cards"); } }

        public static string DatabasesDirectory { get { return Path.Combine(BaseDirectory, "databases"); } }

        public static string FontsDirectory { get { return Path.Combine(BaseDirectory, "fonts"); } }

        public static string TextDirectory { get { return Path.Combine(BaseDirectory, "text"); } }

        public static Plugin Instance { get; private set; }

        public static ManualLogSource LoggerInstance { get { return Instance.Logger; } }

        private static readonly Dictionary<string, string> attksNameDatabase = new Dictionary<string, string>();

        private static readonly Dictionary<string, string> attksTextDatabase = new Dictionary<string, string>();

        private static readonly Dictionary<string, string> locTextTable = new Dictionary<string, string>();

        private static readonly Dictionary<string, string> namesDatabase = new Dictionary<string, string>();

        private static string untranslatedTextFile { get { return Path.Combine(BaseDirectory, "untranslated.txt"); } }

        private static readonly Dictionary<string, string> untranslatedTextTable = new Dictionary<string, string>();

        private void Awake()
        {
            Configuration.Initialization(Config);
            Instance = this;

            if (File.Exists(Path.Combine(BaseDirectory, "disabled")))
            {
                return;
            }

            if (Directory.Exists(TextDirectory)) {
                var locTextFiles = Directory.GetFiles(TextDirectory, "*.txt");
                foreach (var file in locTextFiles)
                {
                    LoadLocFile(file, locTextTable);
                }
            }

            LoadLocFile(Path.Combine(DatabasesDirectory, "attks-name.txt"), attksNameDatabase);
            LoadLocFile(Path.Combine(DatabasesDirectory, "attks-text.txt"), attksTextDatabase);
            LoadLocFile(Path.Combine(DatabasesDirectory, "names.txt"), namesDatabase);
            LoadLocFile(untranslatedTextFile, untranslatedTextTable);

            try
            {
                var asmNamePather = Harmony.CreateAndPatchAll(typeof(AssemblyNamePatcher));
                Harmony.CreateAndPatchAll(typeof(AssetBundlePatcher));
                Harmony.CreateAndPatchAll(typeof(CardDatabasePatcher));
                if (Configuration.EnableCardGraphicText.Value)
                {
                    Harmony.CreateAndPatchAll(typeof(CardGraphicPatcher));
                }
                Harmony.CreateAndPatchAll(typeof(LocalizationPatcher));
                Harmony.CreateAndPatchAll(typeof(TextMeshProPatcher));
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
            for (int i = 0; i < 4; i++)
            {
                var key = "EN Attack Name" + (i > 0 ? $" {i + 1}" : "");
                if (attksNameDatabase.TryGetValue(Helper.md5sum(row[key].ToString()), out var value))
                {
                    row[key] = value;
                }
            }
            for (int i = 0; i < 4; i++)
            {
                var key = "EN Attack Text" + (i > 0 ? $" {i + 1}" : "");
                if (attksTextDatabase.TryGetValue(Helper.md5sum(row[key].ToString()), out var value))
                {
                    row[key] = value;
                }
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
                var lines = File.ReadAllText(file).Split('\n');
                var key = string.Empty;
                var value = string.Empty;
                foreach (var line in lines)
                {
                    if (line.StartsWith("|") && !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(value))
                    {
                        dict[key] = value.Trim();
                        key = string.Empty;
                        value = string.Empty;
                    }
                    var i = line.IndexOf(':');
                    if (i != -1 && line.StartsWith("|"))
                    {
                        key = line.Substring(1, i - 1);
                        value += line.Substring(i + 1);
                    } else
                    {
                        value += line;
                    }
                    value += "\n";

                }
            }
            catch (Exception ex)
            {
                LoggerInstance.LogError(ex);
            }
        }
    }
}
