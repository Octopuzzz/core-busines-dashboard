import type { EChartsOption } from "echarts";

export async function chartToImage(
  option: EChartsOption,
  width = 900,
  height = 420,
): Promise<string> {
  const echarts = await import("echarts");

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  document.body.appendChild(container);

  const chart = echarts.init(container, undefined, { renderer: "canvas", width, height });
  try {
    chart.setOption({
      ...option,
      animation: false,
      textStyle: { fontFamily: "Helvetica, Arial, sans-serif" },
    });
    return chart.getDataURL({ type: "jpeg", pixelRatio: 1.5, backgroundColor: "#ffffff" });
  } finally {
    chart.dispose();
    container.remove();
  }
}
