using System;
using System.IO;

namespace Webority.Cli
{
    // The Figma plugin ships INSIDE the CLI as embedded resources and is materialized to the
    // stable per-machine path ~/.webority/figma-plugin/ on every MCP server start (write-if-
    // changed). Figma dev plugins re-read their files from disk on every run, so a single
    // manifest import from that path keeps the plugin current with every CLI release — no
    // re-import, no repo clone needed on the machine.
    internal static class FigmaPluginInstaller
    {
        private static readonly (string Resource, string RelativePath)[] Files =
        {
            ("figmaplugin.manifest.json", "manifest.json"),
            ("figmaplugin.code.js", Path.Combine("dist", "code.js")),
            ("figmaplugin.index.html", Path.Combine("dist", "index.html")),
        };

        public static string PluginDirectory { get; } = Path.Combine(TokenStore.ConfigDirectory, "figma-plugin");

        public static string ManifestPath { get; } = Path.Combine(PluginDirectory, "manifest.json");

        public const string PluginDisplayName = "Webority Figma MCP (weborityos CLI)";

        // The CLI release version, stamped into the plugin UI at materialization so the plugin can
        // announce its build on connect and the bridge can tell a current plugin from a stale copy.
        public static string CliVersion { get; } =
            typeof(FigmaPluginInstaller).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

        private const string VersionPlaceholder = "__WEBORITY_PLUGIN_VERSION__";

        public static string ImportHint =>
            $"Open the '{PluginDisplayName}' plugin in your Figma desktop file (Plugins > Development — import it once from {ManifestPath}) and keep it open, then retry.";

        public static string StalePluginHint =>
            $"The connected Figma plugin is an older build than this CLI ({CliVersion}). In Figma, Plugins > Development: remove every 'Webority Figma MCP' entry, import {ManifestPath}, and open that one.";

        // Best-effort: a failure here must never break the MCP server; the sync re-runs on the
        // next start.
        public static void Sync()
        {
            try
            {
                Directory.CreateDirectory(Path.Combine(PluginDirectory, "dist"));
                var assembly = typeof(FigmaPluginInstaller).Assembly;
                foreach (var (resource, relativePath) in Files)
                {
                    using var stream = assembly.GetManifestResourceStream(resource);
                    if (stream == null)
                    {
                        continue;
                    }
                    using var memory = new MemoryStream();
                    stream.CopyTo(memory);
                    var bytes = memory.ToArray();
                    if (relativePath.EndsWith("index.html", StringComparison.Ordinal))
                    {
                        var html = System.Text.Encoding.UTF8.GetString(bytes).Replace(VersionPlaceholder, CliVersion, StringComparison.Ordinal);
                        bytes = System.Text.Encoding.UTF8.GetBytes(html);
                    }
                    var target = Path.Combine(PluginDirectory, relativePath);
                    if (!File.Exists(target) || !bytes.AsSpan().SequenceEqual(File.ReadAllBytes(target)))
                    {
                        File.WriteAllBytes(target, bytes);
                    }
                }
            }
            catch (Exception)
            {
                // Never let plugin materialization take down the MCP server.
            }
        }
    }
}
