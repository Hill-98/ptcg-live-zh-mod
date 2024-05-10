using HarmonyLib;
using System.Reflection;

namespace PTCGLiveZhMod.Patches
{
    internal static class AssemblyNamePatcher
    {
        /// <summary>
        /// (暴力)修复 AssemblyName 在程序集路径存在非 ANSI 字符时发生异常
        /// </summary>
        [HarmonyPatch(typeof(AssemblyName), "Create")]
        [HarmonyPrefix]
        static void CreatePrefix(ref bool fillCodebase)
        {
            fillCodebase = false;
        }
    }
}
