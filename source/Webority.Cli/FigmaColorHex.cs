using System;
using System.Globalization;
using System.Text.Json.Nodes;

namespace Webority.Cli
{
    // Figma serializes every color as {r,g,b[,a]} floats in [0,1] — unreadable for agents and
    // humans alike. Annotate each such object in a response with a "hex" field (non-destructive:
    // the raw floats stay) so fills, strokes, effects, and variable values read at a glance.
    internal static class FigmaColorHex
    {
        public static JsonNode Annotate(JsonNode node)
        {
            Walk(node);
            return node;
        }

        private static void Walk(JsonNode node)
        {
            switch (node)
            {
                case JsonObject obj:
                    if (IsColor(obj, out var hex) && !obj.ContainsKey("hex"))
                    {
                        obj["hex"] = hex;
                    }
                    foreach (var (_, child) in obj)
                    {
                        Walk(child);
                    }
                    break;
                case JsonArray array:
                    foreach (var child in array)
                    {
                        Walk(child);
                    }
                    break;
            }
        }

        private static bool IsColor(JsonObject obj, out string hex)
        {
            hex = null;
            if (!TryChannel(obj, "r", out var r) || !TryChannel(obj, "g", out var g) || !TryChannel(obj, "b", out var b))
            {
                return false;
            }
            hex = string.Create(CultureInfo.InvariantCulture, $"#{ToByte(r):X2}{ToByte(g):X2}{ToByte(b):X2}");
            return true;
        }

        private static bool TryChannel(JsonObject obj, string name, out double value)
        {
            value = 0;
            if (obj[name] is not JsonValue jsonValue || !jsonValue.TryGetValue(out value))
            {
                return false;
            }
            return value >= 0 && value <= 1;
        }

        private static int ToByte(double channel) => (int)Math.Round(channel * 255, MidpointRounding.AwayFromZero);
    }
}
