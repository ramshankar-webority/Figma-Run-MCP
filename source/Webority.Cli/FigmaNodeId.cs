using System;
using System.Text.RegularExpressions;

namespace Webority.Cli
{
    // Figma's API takes node ids in colon form ('425:95') while its URLs carry dash form
    // ('node-id=425-95'), and agents paste whichever they have. Normalize every accepted shape
    // to the API form so the mismatch never surfaces as a cryptic 'Node not found'.
    internal static partial class FigmaNodeId
    {
        [GeneratedRegex(@"node-id=([0-9]+(?:-[0-9]+)+)", RegexOptions.IgnoreCase)]
        private static partial Regex UrlNodeId();

        [GeneratedRegex(@"^[0-9]+(?:-[0-9]+)+$")]
        private static partial Regex DashForm();

        public static string Normalize(string nodeId)
        {
            if (string.IsNullOrWhiteSpace(nodeId))
            {
                return nodeId;
            }
            var value = nodeId.Trim();
            var url = UrlNodeId().Match(value);
            if (url.Success)
            {
                value = url.Groups[1].Value;
            }
            if (DashForm().IsMatch(value))
            {
                return value.Replace('-', ':');
            }
            return value;
        }
    }
}
