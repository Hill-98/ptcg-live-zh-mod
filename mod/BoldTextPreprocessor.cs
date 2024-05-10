using TMPro;

namespace PTCGLiveZhMod
{
    public class BoldTextPreprocessor : ITextPreprocessor
    {
        public string PreprocessText(string text)
        {
            return text.Contains("<b>") ? text : $"<b>{text}</b>";
        }
    }
}
