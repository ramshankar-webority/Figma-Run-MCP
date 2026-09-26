using System;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace Webority.Cli
{
    // Read-only bridge into the Figma desktop file open on this machine, via the local
    // 'Webority Figma MCP (weborityos CLI)' plugin (FigmaBridge owns the transport). Every tool fails with an
    // actionable message when the plugin is not open; nothing here ever edits the Figma file.
    [McpServerToolType]
    public static class FigmaTools
    {
        private const string NodeIdForms =
            "Node id, e.g. '425:95'. URL forms are accepted too — '425-95' or a full Figma URL containing node-id= is normalized automatically.";

        private const string PageIdDescription =
            "Page id (from figma_get_metadata). Omit for the page currently open in Figma.";

        private const int ExportTimeoutMs = 60000;
        private const int DefaultTimeoutMs = 30000;

        [McpServerTool(Name = "figma_status", ReadOnly = true)]
        [Description("Report whether the Figma desktop plugin is connected to this machine's bridge, which build it is, and which file it has open. Call this first when any other figma_* tool errors — it tells you whether the 'Webority Figma MCP (weborityos CLI)' plugin needs to be opened in Figma (Plugins > Development), and warns when the connected plugin is an older copy than this CLI.")]
        public static async Task<string> FigmaStatus(FigmaBridge bridge, CancellationToken cancellationToken = default)
        {
            var (isLeader, pluginConnected, pluginVersion) = await bridge.StatusWithVersionAsync(cancellationToken);
            var role = isLeader ? "leader" : "follower";
            if (!pluginConnected)
            {
                return $"Bridge running (this session is the {role}), but no Figma plugin is connected. " + FigmaPluginInstaller.ImportHint;
            }
            var metadata = await bridge.InvokeAsync("get_metadata", null, DefaultTimeoutMs, cancellationToken);
            var result = new JsonObject
            {
                ["connected"] = true,
                ["session"] = role,
                ["pluginVersion"] = pluginVersion,
                ["cliVersion"] = FigmaPluginInstaller.CliVersion,
                ["file"] = metadata
            };
            if (pluginVersion == null)
            {
                result["warning"] = "The connected plugin did not announce a build, so it predates this CLI's plugin; figma_find_nodes and figma_get_text will fail on it. " + FigmaPluginInstaller.StalePluginHint;
            }
            else if (!string.Equals(pluginVersion, FigmaPluginInstaller.CliVersion, StringComparison.Ordinal))
            {
                result["warning"] = $"The connected plugin is build {pluginVersion} while this CLI is {FigmaPluginInstaller.CliVersion}. Restart the plugin in Figma to pick up the current files; if that does not change the build, " + FigmaPluginInstaller.StalePluginHint;
            }
            return result.ToJsonString();
        }

        [McpServerTool(Name = "figma_get_metadata", ReadOnly = true)]
        [Description("Get the open Figma file's name, its pages, and the current page. Page ids from here are what figma_get_document / figma_find_nodes / figma_get_text accept as pageId — you can read any page without switching pages in Figma.")]
        public static async Task<string> FigmaGetMetadata(FigmaBridge bridge, CancellationToken cancellationToken = default) =>
            Serialize(await bridge.InvokeAsync("get_metadata", null, DefaultTimeoutMs, cancellationToken));

        [McpServerTool(Name = "figma_get_document", ReadOnly = true)]
        [Description("Get a Figma page's node tree, depth-limited. Deep trees are large — to locate a specific frame or layer, prefer figma_find_nodes, then figma_get_node on the hit. Colors carry a 'hex' field alongside Figma's raw r/g/b floats.")]
        public static async Task<string> FigmaGetDocument(
            FigmaBridge bridge,
            [Description("Levels of children to include, 1-10. Omit for the default 1 (page + top-level frames) — deep trees on large pages are huge, so raise depth deliberately, or figma_get_node a subtree instead.")] int depth = 1,
            [Description(PageIdDescription)] string pageId = null,
            CancellationToken cancellationToken = default)
        {
            RequireRange(depth, 1, 10, nameof(depth));
            var parameters = new JsonObject { ["depth"] = depth };
            AddPageId(parameters, pageId);
            return Serialize(await bridge.InvokeAsync("get_document", parameters, ExportTimeoutMs, cancellationToken));
        }

        [McpServerTool(Name = "figma_get_node", ReadOnly = true)]
        [Description("Get a single Figma node and its subtree, depth-limited. Colors carry a 'hex' field; image fills expose fills[].imageHash for figma_save_image.")]
        public static async Task<string> FigmaGetNode(
            FigmaBridge bridge,
            [Description("Required — " + NodeIdForms)] string nodeId,
            [Description("Levels of children to include, 0-10. Omit for the default 2.")] int depth = 2,
            CancellationToken cancellationToken = default)
        {
            RequireRange(depth, 0, 10, nameof(depth));
            var parameters = new JsonObject { ["nodeId"] = FigmaNodeId.Normalize(nodeId), ["depth"] = depth };
            return Serialize(await bridge.InvokeAsync("get_node", parameters, DefaultTimeoutMs, cancellationToken));
        }

        [McpServerTool(Name = "figma_get_selection", ReadOnly = true)]
        [Description("Get the nodes the user currently has selected in Figma — the fastest way to talk about 'this one': ask the user to select it, then read it here.")]
        public static async Task<string> FigmaGetSelection(
            FigmaBridge bridge,
            [Description("Levels of children to include per selected node, 0-10. Omit for the default 1.")] int depth = 1,
            CancellationToken cancellationToken = default)
        {
            RequireRange(depth, 0, 10, nameof(depth));
            var parameters = new JsonObject { ["depth"] = depth };
            return Serialize(await bridge.InvokeAsync("get_selection", parameters, DefaultTimeoutMs, cancellationToken));
        }

        [McpServerTool(Name = "figma_find_nodes", ReadOnly = true)]
        [Description("Search nodes by name and/or type without dumping the tree — the cheap way to locate a frame, component, or layer. Returns compact rows (id, name, type, size, childCount; page when searching all pages), capped at 300 with a 'truncated' flag. Pass at least one of query/nodeType.")]
        public static async Task<string> FigmaFindNodes(
            FigmaBridge bridge,
            [Description("Case-insensitive substring matched against node names, e.g. 'hero'. Omit to match every name (filter by nodeType instead).")] string query = null,
            [McpEnum("figmaNodeType")]
            [Description("Figma node type filter, e.g. FRAME, COMPONENT, INSTANCE, TEXT, RECTANGLE, GROUP, SECTION. Omit for all types.")] string nodeType = null,
            [Description("Page id to search (from figma_get_metadata), or 'all' to search every page. Omit for the current page.")] string pageId = null,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(query) && string.IsNullOrWhiteSpace(nodeType))
            {
                throw new InvalidOperationException("Pass query and/or nodeType — an unfiltered find would return every node on the page. Use figma_get_document for the full tree.");
            }
            var parameters = new JsonObject();
            if (!string.IsNullOrWhiteSpace(query))
            {
                parameters["query"] = query;
            }
            if (!string.IsNullOrWhiteSpace(nodeType))
            {
                parameters["nodeType"] = nodeType.ToUpperInvariant();
            }
            AddPageId(parameters, pageId);
            return Serialize(await bridge.InvokeAsync("find_nodes", parameters, ExportTimeoutMs, cancellationToken));
        }

        [McpServerTool(Name = "figma_get_text", ReadOnly = true)]
        [Description("Extract all text content as flat rows (id, name, characters) — the cheap way to review copy without tree dumps. Scope: nodeId if given, else pageId, else the current page. Capped at 500 rows with a 'truncated' flag — when truncated, narrow the scope (a section/frame nodeId) and call again.")]
        public static async Task<string> FigmaGetText(
            FigmaBridge bridge,
            [Description("Scope to this node's subtree. " + NodeIdForms + " Omit to scope by page.")] string nodeId = null,
            [Description(PageIdDescription)] string pageId = null,
            CancellationToken cancellationToken = default)
        {
            var parameters = new JsonObject();
            if (!string.IsNullOrWhiteSpace(nodeId))
            {
                parameters["nodeId"] = FigmaNodeId.Normalize(nodeId);
            }
            AddPageId(parameters, pageId);
            return Serialize(await bridge.InvokeAsync("get_text", parameters, ExportTimeoutMs, cancellationToken));
        }

        [McpServerTool(Name = "figma_get_styles", ReadOnly = true)]
        [Description("Get all local paint, text, effect, and grid styles for the open file. Colors carry a 'hex' field alongside Figma's raw r/g/b floats.")]
        public static async Task<string> FigmaGetStyles(FigmaBridge bridge, CancellationToken cancellationToken = default) =>
            Serialize(await bridge.InvokeAsync("get_styles", null, DefaultTimeoutMs, cancellationToken));

        [McpServerTool(Name = "figma_get_variable_defs", ReadOnly = true)]
        [Description("Get all local variable collections, modes, and values (design tokens / brand kit). Color values carry a 'hex' field alongside Figma's raw r/g/b floats.")]
        public static async Task<string> FigmaGetVariableDefs(FigmaBridge bridge, CancellationToken cancellationToken = default) =>
            Serialize(await bridge.InvokeAsync("get_variable_defs", null, DefaultTimeoutMs, cancellationToken));

        [McpServerTool(Name = "figma_get_screenshot", ReadOnly = true)]
        [Description("Render a Figma node to an image and return it inline (PNG/JPG as an image block, SVG as markup). For saving to disk use figma_save_screenshot instead.")]
        public static async Task<CallToolResult> FigmaGetScreenshot(
            FigmaBridge bridge,
            [Description("Required — the node to render. " + NodeIdForms)] string nodeId,
            [McpEnum("figmaExportFormat")]
            [Description("Output format: PNG, JPG, or SVG. Omit for PNG.")] string format = "PNG",
            [Description("Raster scale for PNG/JPG, 0.1-4 (ignored for SVG). Omit for the default 2.")] double scale = 2,
            CancellationToken cancellationToken = default)
        {
            var (base64, canonicalFormat) = await ExportAsync(bridge, nodeId, format, scale, cancellationToken);
            if (canonicalFormat == "SVG")
            {
                return new CallToolResult
                {
                    Content = [new TextContentBlock { Text = Encoding.UTF8.GetString(Convert.FromBase64String(base64)) }]
                };
            }
            return new CallToolResult
            {
                Content = [new ImageContentBlock { Data = Convert.FromBase64String(base64), MimeType = canonicalFormat == "JPG" ? "image/jpeg" : "image/png" }]
            };
        }

        [McpServerTool(Name = "figma_save_screenshot")]
        [Description("Render a Figma node and save it to a local file path. Returns the path and byte size. For a quick inline look use figma_get_screenshot instead.")]
        public static async Task<string> FigmaSaveScreenshot(
            FigmaBridge bridge,
            [Description("Required — the node to render. " + NodeIdForms)] string nodeId,
            [Description("Required — absolute local file path to write.")] string path,
            [McpEnum("figmaExportFormat")]
            [Description("Output format: PNG, JPG, or SVG. Omit for PNG.")] string format = "PNG",
            [Description("Raster scale for PNG/JPG, 0.1-4 (ignored for SVG). Omit for the default 2.")] double scale = 2,
            CancellationToken cancellationToken = default)
        {
            var (base64, canonicalFormat) = await ExportAsync(bridge, nodeId, format, scale, cancellationToken);
            var bytes = Convert.FromBase64String(base64);
            await File.WriteAllBytesAsync(path, bytes, cancellationToken);
            return new JsonObject { ["saved"] = path, ["bytes"] = bytes.Length, ["format"] = canonicalFormat }.ToJsonString();
        }

        [McpServerTool(Name = "figma_save_image")]
        [Description("Extract a raw Figma image ASSET by its imageHash (the clean source photo/screenshot behind a fill, without overlay layers) and save it to a local file path. Get the hash from figma_get_node fills[].imageHash.")]
        public static async Task<string> FigmaSaveImage(
            FigmaBridge bridge,
            [Description("Required — the imageHash of an image fill (from figma_get_node fills[].imageHash).")] string hash,
            [Description("Required — absolute local file path to write.")] string path,
            CancellationToken cancellationToken = default)
        {
            var parameters = new JsonObject { ["hash"] = hash };
            var result = await bridge.InvokeAsync("get_image", parameters, ExportTimeoutMs, cancellationToken);
            var bytes = Convert.FromBase64String(RequireBase64(result));
            await File.WriteAllBytesAsync(path, bytes, cancellationToken);
            return new JsonObject { ["saved"] = path, ["bytes"] = bytes.Length }.ToJsonString();
        }

        private static async Task<(string Base64, string Format)> ExportAsync(
            FigmaBridge bridge, string nodeId, string format, double scale, CancellationToken cancellationToken)
        {
            var canonical = (format ?? "PNG").ToUpperInvariant();
            if (canonical is not ("PNG" or "JPG" or "SVG"))
            {
                throw new InvalidOperationException($"format must be PNG, JPG, or SVG — got '{format}'.");
            }
            if (scale is < 0.1 or > 4)
            {
                throw new InvalidOperationException($"scale must be between 0.1 and 4 — got {scale.ToString(CultureInfo.InvariantCulture)}.");
            }
            var parameters = new JsonObject
            {
                ["nodeId"] = FigmaNodeId.Normalize(nodeId),
                ["format"] = canonical,
                ["scale"] = scale
            };
            var result = await bridge.InvokeAsync("export", parameters, ExportTimeoutMs, cancellationToken);
            return (RequireBase64(result), canonical);
        }

        private static string RequireBase64(JsonNode result)
        {
            if (result?["base64"] is JsonValue value && value.TryGetValue<string>(out var base64) && !string.IsNullOrEmpty(base64))
            {
                return base64;
            }
            throw new InvalidOperationException("The Figma plugin returned no image data for this export — check figma_status and retry.");
        }

        private static void AddPageId(JsonObject parameters, string pageId)
        {
            if (!string.IsNullOrWhiteSpace(pageId))
            {
                parameters["pageId"] = string.Equals(pageId, "all", StringComparison.OrdinalIgnoreCase)
                    ? "all"
                    : FigmaNodeId.Normalize(pageId);
            }
        }

        private static void RequireRange(int value, int min, int max, string paramName)
        {
            if (value < min || value > max)
            {
                throw new InvalidOperationException(
                    $"{paramName} must be between {min.ToString(CultureInfo.InvariantCulture)} and {max.ToString(CultureInfo.InvariantCulture)} — got {value.ToString(CultureInfo.InvariantCulture)}.");
            }
        }

        private static string Serialize(JsonNode result) =>
            result == null ? "null" : FigmaColorHex.Annotate(result).ToJsonString();
    }
}
