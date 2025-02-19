using BepInEx;
using BepInEx.Configuration;
using System.IO;

namespace PTCGLiveZhMod
{
    internal static class Configuration
    {
        public static ConfigEntry<bool> DumpAllCards { get; private set; }
        public static ConfigEntry<bool> DumpAllLocalizationText { get; private set; }
        public static ConfigEntry<bool> DumpUntranslatedText { get; private set; }

        public static ConfigEntry<bool> EnableCardGraphicText { get; private set; }

        private static bool Initialized = false;
        public static void Initialization(ConfigFile config)
        {
            if (Initialized)
            {
                return;
            }
            DumpAllCards = config.Bind("dump", "DumpAllCards", false);
            DumpAllLocalizationText = config.Bind("dump", "DumpAllLocalizationText", false);
            DumpUntranslatedText = config.Bind("dump", "DumpUntranslatedText", true);
            EnableCardGraphicText = config.Bind("card", "EnableCardGraphicText", false);
        }
    }
}
