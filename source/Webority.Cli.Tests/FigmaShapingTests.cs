using System.Text.Json.Nodes;
using Webority.Cli;
using Xunit;

namespace Webority.Cli.Tests
{
    public class FigmaShapingTests
    {
        [Theory]
        [InlineData("425:95", "425:95")]
        [InlineData("425-95", "425:95")]
        [InlineData(" 425-95 ", "425:95")]
        [InlineData("1-2-3", "1:2:3")]
        [InlineData("https://www.figma.com/design/abc/File?node-id=425-95&t=xyz", "425:95")]
        [InlineData("I425:95;10:2", "I425:95;10:2")]
        [InlineData("hero-frame", "hero-frame")]
        public void Normalize_AcceptsEveryPastedForm(string input, string expected) =>
            Assert.Equal(expected, FigmaNodeId.Normalize(input));

        [Fact]
        public void Annotate_AddsHexToColorObjects()
        {
            var node = JsonNode.Parse("{\"fills\":[{\"type\":\"SOLID\",\"color\":{\"r\":0.129,\"g\":0.588,\"b\":0.953,\"a\":1}}]}");
            FigmaColorHex.Annotate(node);
            Assert.Equal("#2196F3", node["fills"][0]["color"]["hex"].GetValue<string>());
        }

        [Fact]
        public void Annotate_IgnoresNonColorShapes()
        {
            // r/g/b present but out of the [0,1] float range -> not a Figma color object.
            var node = JsonNode.Parse("{\"box\":{\"r\":425.0,\"g\":95.0,\"b\":12.0},\"width\":100}");
            FigmaColorHex.Annotate(node);
            Assert.Null(node["box"]["hex"]);
        }

        [Fact]
        public void Annotate_ReachesNestedGradientStops()
        {
            var node = JsonNode.Parse(
                "{\"fills\":[{\"type\":\"GRADIENT_LINEAR\",\"gradientStops\":[{\"position\":0,\"color\":{\"r\":1,\"g\":1,\"b\":1,\"a\":1}},{\"position\":1,\"color\":{\"r\":0,\"g\":0,\"b\":0,\"a\":1}}]}]}");
            FigmaColorHex.Annotate(node);
            Assert.Equal("#FFFFFF", node["fills"][0]["gradientStops"][0]["color"]["hex"].GetValue<string>());
            Assert.Equal("#000000", node["fills"][0]["gradientStops"][1]["color"]["hex"].GetValue<string>());
        }
    }
}
