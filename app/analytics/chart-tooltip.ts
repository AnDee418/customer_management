/**
 * 分析ページのチャートツールチップ機能
 */

export function initializeAnalyticsChartTooltip() {
  if (typeof window === 'undefined') return

  const dataPoints = document.querySelectorAll('.data-point')
  const tooltip = document.getElementById('analytics-chart-tooltip')

  if (!tooltip) return

  dataPoints.forEach((point) => {
    point.addEventListener('mouseenter', (e) => {
      const target = e.target as SVGCircleElement
      const month = target.getAttribute('data-month')
      const value = target.getAttribute('data-value')
      const change = target.getAttribute('data-change')

      if (month && value && change) {
        const tooltipMonth = tooltip.querySelector('.tooltip-month')
        const tooltipValue = tooltip.querySelector('.tooltip-value')
        const tooltipChange = tooltip.querySelector('.tooltip-change')

        if (tooltipMonth) tooltipMonth.textContent = month
        if (tooltipValue) tooltipValue.textContent = `${value}件`
        if (tooltipChange) {
          tooltipChange.textContent = `前月比 ${change}`
          ;(tooltipChange as HTMLElement).style.color = change.startsWith('+') ? '#10b981' : '#ef4444'
        }

        tooltip.classList.add('show')
      }
    })

    point.addEventListener('mousemove', (e) => {
      const mouseEvent = e as MouseEvent
      const chartBody = (e.target as SVGCircleElement).closest('.chart-body')

      if (chartBody && tooltip.classList.contains('show')) {
        const bodyRect = chartBody.getBoundingClientRect()

        // マウスカーソルの位置からの相対位置を計算
        const offsetX = 15 // カーソルから右に15pxずらす
        const offsetY = 20 // カーソルから下に20pxずらす

        const tooltipX = mouseEvent.clientX - bodyRect.left + offsetX
        const tooltipY = mouseEvent.clientY - bodyRect.top + offsetY

        tooltip.style.left = `${tooltipX}px`
        tooltip.style.top = `${tooltipY}px`
      }
    })

    point.addEventListener('mouseleave', () => {
      tooltip.classList.remove('show')
    })
  })
}
