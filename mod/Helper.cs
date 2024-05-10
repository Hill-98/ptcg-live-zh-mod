using System.Collections;
using System.Security.Cryptography;
using System.Text;

namespace PTCGLiveZhMod
{
    internal static class Helper
    {
        public static string md5sum(string input)
        {
            using (var md5 = MD5.Create())
            {
                byte[] inputBytes = Encoding.UTF8.GetBytes(input);
                byte[] hashBytes = md5.ComputeHash(inputBytes);

                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < hashBytes.Length; i++)
                {
                    sb.Append(hashBytes[i].ToString("X2"));
                }
                return sb.ToString().ToLower();
            }
        }

        public static IEnumerator YieldBreak()
        {
            yield break;
        }
    }
}
