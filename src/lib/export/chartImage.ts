import type { EChartsOption } from "echarts";

/**
 * Renders an ECharts option off-screen and returns it as a JPEG data URL — used to put
 * charts into the PDF. Always light background, no animation.
 */
export async function chartToImage(
  option: EChartsOption,
  width = 900,
  height = 420,
): Promise<string> {
  const echarts = await import("echarts");

  // ECharts needs a real element with a size; park it off-screen.
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  document.body.appendChild(container);

  const chart = echarts.init(container, undefined, { renderer: "canvas", width, height });
  try {
    chart.setOption({
      ...option,
      animation: false,
      // PDF viewers don't have the web font; use a safe system font.
      textStyle: { fontFamily: "Helvetica, Arial, sans-serif" },
    });
    return chart.getDataURL({ type: "jpeg", pixelRatio: 1.5, backgroundColor: "#ffffff" });
  } finally {
    chart.dispose();
    container.remove();
  }
}
