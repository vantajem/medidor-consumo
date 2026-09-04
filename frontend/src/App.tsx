import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Summary = {
  date: string
  energy_kwh: number
  cost_brl: number
}

type LivePower = {
  recorded_at: string
  cpu_power_w: number
  gpu_power_w: number
  total_power_w: number
}

type PowerHistoryPoint = LivePower & {
  energy_kwh: number
}

type DailyTotal = {
  date: string
  energy_kwh: number
  cost_brl: number
}

type ChartPoint = {
  timestamp: string
  values: Record<string, number>
}

type ChartSeries = {
  key: string
  label: string
  color: string
}

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const energyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR')
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`A API respondeu com ${response.status}`)
  }

  return response.json() as Promise<T>
}

function parseLocalDate(date: string) {
  return new Date(`${date}T12:00:00`)
}

function buildEnergyChartPoints(history: PowerHistoryPoint[]): ChartPoint[] {
  let accumulated = 0

  return history.map((item) => {
    accumulated += item.energy_kwh
    return { timestamp: item.recorded_at, values: { energy: accumulated } }
  })
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  )
}

function LineChart({
  points,
  series,
  unit,
}: {
  points: ChartPoint[]
  series: ChartSeries[]
  unit: string
}) {
  if (points.length === 0) {
    return <div className="chart-empty">Ainda não há medições para hoje.</div>
  }

  const width = 1000
  const height = 280
  const padding = { top: 18, right: 22, bottom: 38, left: 60 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const timestamps = points.map((point) => new Date(point.timestamp).getTime())
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const allValues = points.flatMap((point) => series.map((item) => point.values[item.key] ?? 0))
  const rawMax = Math.max(...allValues, 1)
  const magnitude = rawMax < 1 ? 0.01 : rawMax < 10 ? 1 : 10
  const yMax = Math.ceil((rawMax * 1.12) / magnitude) * magnitude

  const xFor = (timestamp: number, index: number) => {
    if (maxTime === minTime) {
      return padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
    }
    return padding.left + ((timestamp - minTime) / (maxTime - minTime)) * plotWidth
  }

  const yFor = (value: number) => padding.top + plotHeight - (value / yMax) * plotHeight
  const gridSteps = [0, 0.25, 0.5, 0.75, 1]

  const buildSegments = (key: string) => {
    const segments: string[][] = [[]]

    points.forEach((point, index) => {
      if (index > 0 && timestamps[index] - timestamps[index - 1] > 120_000) {
        segments.push([])
      }

      segments.at(-1)?.push(`${xFor(timestamps[index], index)},${yFor(point.values[key] ?? 0)}`)
    })

    return segments.filter((segment) => segment.length > 0)
  }

  const tickTimes = [minTime, minTime + (maxTime - minTime) / 2, maxTime]

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de consumo">
        {gridSteps.map((step) => {
          const y = padding.top + plotHeight * step
          const value = yMax * (1 - step)
          return (
            <g key={step}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid" />
              <text x={padding.left - 12} y={y + 5} textAnchor="end" className="chart-label">
                {numberFormatter.format(value)}
              </text>
            </g>
          )
        })}
        {tickTimes.map((timestamp, index) => (
          <text
            key={`${timestamp}-${index}`}
            x={padding.left + (plotWidth * index) / 2}
            y={height - 8}
            textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}
            className="chart-label"
          >
            {timeFormatter.format(new Date(timestamp))}
          </text>
        ))}
        <text x={10} y={14} className="chart-unit">
          {unit}
        </text>
        {series.flatMap((item) =>
          buildSegments(item.key).map((segment, index) => (
            <polyline
              key={`${item.key}-${index}`}
              points={segment.join(' ')}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )),
        )}
      </svg>
    </div>
  )
}

function DailyBars({ items }: { items: DailyTotal[] }) {
  if (items.length === 0) {
    return <div className="chart-empty">Ainda não há histórico diário.</div>
  }

  const maxValue = Math.max(...items.map((item) => item.energy_kwh), 0.001)

  return (
    <div className="daily-chart">
      {items.map((item) => (
        <div className="daily-column" key={item.date}>
          <div className="bar-track">
            <div
              className="daily-bar"
              style={{ height: `${Math.max((item.energy_kwh / maxValue) * 100, 2)}%` }}
              title={`${dateFormatter.format(parseLocalDate(item.date))}: ${energyFormatter.format(item.energy_kwh)} kWh`}
            />
          </div>
          <span>{dateFormatter.format(parseLocalDate(item.date)).slice(0, 5)}</span>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [livePower, setLivePower] = useState<LivePower | null>(null)
  const [powerHistory, setPowerHistory] = useState<PowerHistoryPoint[]>([])
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadLiveData = async () => {
      try {
        const [summaryData, liveData] = await Promise.all([
          fetchJson<Summary>('/api/summary'),
          fetchJson<LivePower | null>('/api/live'),
        ])
        if (!active) return
        setSummary(summaryData)
        setLivePower(liveData)
        setLastUpdated(new Date())
        setError(null)
      } catch (caughtError) {
        if (!active) return
        setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível acessar a API')
      }
    }

    const loadChartData = async () => {
      try {
        const [powerData, dailyData] = await Promise.all([
          fetchJson<PowerHistoryPoint[]>('/api/power/today'),
          fetchJson<DailyTotal[]>('/api/daily'),
        ])
        if (!active) return
        setPowerHistory(powerData)
        setDailyTotals(dailyData)
      } catch (caughtError) {
        if (!active) return
        setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível atualizar os gráficos')
      }
    }

    void loadLiveData()
    void loadChartData()

    const liveTimer = window.setInterval(loadLiveData, 5_000)
    const chartTimer = window.setInterval(loadChartData, 30_000)

    return () => {
      active = false
      window.clearInterval(liveTimer)
      window.clearInterval(chartTimer)
    }
  }, [])

  const validDailyTotals = useMemo(() => {
    if (!summary) return dailyTotals
    return dailyTotals.filter((item) => item.date <= summary.date)
  }, [dailyTotals, summary])

  const statistics = useMemo(() => {
    const averageEnergy = validDailyTotals.length
      ? validDailyTotals.reduce((total, item) => total + item.energy_kwh, 0) / validDailyTotals.length
      : 0
    const averageCost = validDailyTotals.length
      ? validDailyTotals.reduce((total, item) => total + item.cost_brl, 0) / validDailyTotals.length
      : 0
    const biggestDay = validDailyTotals.reduce<DailyTotal | null>(
      (biggest, item) => (!biggest || item.energy_kwh > biggest.energy_kwh ? item : biggest),
      null,
    )

    if (!summary) {
      return { averageEnergy, averageCost, biggestDay, projectedEnergy: 0, projectedCost: 0 }
    }

    const year = Number(summary.date.slice(0, 4))
    const month = Number(summary.date.slice(5, 7))
    const elapsedDays = Number(summary.date.slice(8, 10))
    const daysInMonth = new Date(year, month, 0).getDate()
    const monthPrefix = summary.date.slice(0, 7)
    const monthItems = validDailyTotals.filter((item) => item.date.startsWith(monthPrefix))
    const monthEnergy = monthItems.reduce((total, item) => total + item.energy_kwh, 0)
    const monthCost = monthItems.reduce((total, item) => total + item.cost_brl, 0)
    const projectedEnergy = elapsedDays ? (monthEnergy / elapsedDays) * daysInMonth : 0
    const projectedCost = elapsedDays ? (monthCost / elapsedDays) * daysInMonth : 0

    return { averageEnergy, averageCost, biggestDay, projectedEnergy, projectedCost }
  }, [summary, validDailyTotals])

  const powerChartPoints = useMemo<ChartPoint[]>(
    () =>
      powerHistory.map((item) => ({
        timestamp: item.recorded_at,
        values: {
          total: item.total_power_w,
          cpu: item.cpu_power_w,
          gpu: item.gpu_power_w,
        },
      })),
    [powerHistory],
  )

  const energyChartPoints = useMemo(() => buildEnergyChartPoints(powerHistory), [powerHistory])
  const collectorIsFresh = Boolean(
    livePower &&
      lastUpdated &&
      lastUpdated.getTime() - new Date(livePower.recorded_at).getTime() < 15_000,
  )

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="header-copy">
          <h1>Medidor de Consumo</h1>
          <p>
            {summary ? `${dateFormatter.format(parseLocalDate(summary.date))} · dados armazenados localmente` : 'Carregando dados...'}
          </p>
        </div>
        <div className={`connection-status ${error || !collectorIsFresh ? 'offline' : ''}`}>
          <i />
          {error ? 'API indisponível' : collectorIsFresh ? 'Monitor online' : 'Coletor parado'}
        </div>
      </header>

      {error && <div className="error-banner">{error}. Tentando novamente automaticamente.</div>}

      <section className="metrics-grid" aria-label="Resumo do consumo">
        <MetricCard
          label="Consumo hoje"
          value={`${energyFormatter.format(summary?.energy_kwh ?? 0)} kWh`}
          detail="desde 00:00"
        />
        <MetricCard
          label="Custo hoje"
          value={currencyFormatter.format(summary?.cost_brl ?? 0)}
          detail="tarifa configurada"
        />
        <MetricCard
          label="Média diária"
          value={`${energyFormatter.format(statistics.averageEnergy)} kWh`}
          detail={currencyFormatter.format(statistics.averageCost)}
        />
        <MetricCard
          label="Previsão do mês"
          value={`${numberFormatter.format(statistics.projectedEnergy)} kWh`}
          detail={currencyFormatter.format(statistics.projectedCost)}
        />
      </section>

      <section className="live-panel">
        <div>
          <span className="panel-kicker">Potência atual</span>
          <strong>{numberFormatter.format(livePower?.total_power_w ?? 0)} <small>W</small></strong>
          <span className="updated-at">
            {lastUpdated ? `Atualizado às ${timeFormatter.format(lastUpdated)}` : 'Aguardando a primeira leitura'}
          </span>
        </div>
        <div className="power-breakdown">
          <div>
            <span><i className="cpu-dot" />CPU</span>
            <strong>{numberFormatter.format(livePower?.cpu_power_w ?? 0)} W</strong>
          </div>
          <div>
            <span><i className="gpu-dot" />GPU</span>
            <strong>{numberFormatter.format(livePower?.gpu_power_w ?? 0)} W</strong>
          </div>
          <div>
            <span><i className="extra-dot" />Outros</span>
            <strong>{numberFormatter.format(Math.max((livePower?.total_power_w ?? 0) - (livePower?.cpu_power_w ?? 0) - (livePower?.gpu_power_w ?? 0), 0))} W</strong>
          </div>
        </div>
      </section>

      {statistics.biggestDay && (
        <section className="highlight-row">
          <span>Dia de maior consumo</span>
          <strong>{dateFormatter.format(parseLocalDate(statistics.biggestDay.date))}</strong>
          <span>{energyFormatter.format(statistics.biggestDay.energy_kwh)} kWh</span>
        </section>
      )}

      <section className="charts-grid">
        <article className="chart-card chart-card-wide">
          <div className="card-heading">
            <div>
              <h2>Potência ao longo do dia</h2>
            </div>
            <span className="refresh-note">gráfico atualiza a cada 30s</span>
          </div>
          <LineChart
            points={powerChartPoints}
            series={[
              { key: 'total', label: 'Total', color: '#24d99b' },
              { key: 'cpu', label: 'CPU', color: '#5aa9ff' },
              { key: 'gpu', label: 'GPU', color: '#a78bfa' },
            ]}
            unit="W"
          />
        </article>

        <article className="chart-card">
          <div className="card-heading">
            <div>
              <h2>Consumo acumulado</h2>
            </div>
          </div>
          <LineChart
            points={energyChartPoints}
            series={[{ key: 'energy', label: 'Energia', color: '#f8b84e' }]}
            unit="kWh"
          />
        </article>

        <article className="chart-card">
          <div className="card-heading">
            <div>
              <h2>Consumo por dia</h2>
            </div>
          </div>
          <DailyBars items={validDailyTotals} />
        </article>
      </section>

      <footer>
        Estimativa: CPU + GPU + 50 W adicionais. Medição real exige um medidor na tomada.
      </footer>
    </main>
  )
}

export default App
