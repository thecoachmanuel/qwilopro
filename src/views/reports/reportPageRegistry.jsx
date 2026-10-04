import React from "react";
import ReactApexChart from "react-apexcharts";
import { formatReportValue } from "../../utils/reportExports.jsx";

const getRows = (data, tableIndex = 0) => data?.tables?.[tableIndex]?.rows || [];
const getColumns = (data, tableIndex = 0) => data?.tables?.[tableIndex]?.columns || [];

const pickColumn = (columns, keys) => columns.find((column) => keys.includes(column.key))?.key;

const getCategoryKey = (columns) => (
  columns.find((column) => !["money", "number", "quantity"].includes(column.type))?.key || columns[0]?.key
);

const getValueKey = (columns) => (
  pickColumn(columns, ["revenue", "total", "gross_sales", "net_sales", "tax_total", "service_charge_total", "estimated_total", "quantity", "orders", "feedback_count"])
  || columns.find((column) => ["money", "number", "quantity"].includes(column.type))?.key
);

const hasUsableValues = (rows, keys) => (
  rows.length > 0 && keys.some((key) => rows.some((row) => Number(row?.[key] || 0) !== 0))
);

const availableKeys = (columns, keys) => keys.filter((key) => columns.some((column) => column.key === key));

const formatChartCategory = (value, key, columns = []) => {
  const columnType = columns.find((column) => column.key === key)?.type;
  const rawValue = value == null ? "-" : String(value);

  if (columnType === "date" || columnType === "datetime" || /date|created_at|updated_at|last_.*_at|first_.*|last_.*/.test(String(key))) {
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
  }

  return rawValue;
};

const groupRowsByDate = (rows, dateKey = "created_at", valueKey = "total") => {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!row?.[dateKey]) return;
    const date = formatChartCategory(row[dateKey], dateKey, [{ key: dateKey, type: "datetime" }]);
    const current = grouped.get(date) || { date, total: 0, invoices: 0 };
    current.total += Number(row[valueKey] || 0);
    current.invoices += 1;
    grouped.set(date, current);
  });

  return [...grouped.values()].reverse();
};

const makeMatrixSeries = (rows, xKey, yKey, valueKey, columns) => {
  const xValues = [...new Set(rows.map((row) => formatChartCategory(row[xKey], xKey, columns)))];
  const yValues = [...new Set(rows.map((row) => String(row[yKey] ?? "-")))];

  return yValues.map((yValue) => ({
    name: yValue,
    data: xValues.map((xValue) => {
      const value = rows
        .filter((row) => formatChartCategory(row[xKey], xKey, columns) === xValue && String(row[yKey] ?? "-") === yValue)
        .reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);

      return { x: xValue, y: value };
    }),
  }));
};

function ChartPanel({ title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-restro-border-green bg-background shadow-sm">
      <div className="border-b border-restro-border-green bg-restro-bg-gray/30 px-5 py-4">
        <h2 className="font-bold text-foreground">{title}</h2>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function BarChart({ rows, columns, title, categoryKey, valueKey, currency }) {
  const category = categoryKey || getCategoryKey(columns);
  const value = valueKey || getValueKey(columns);
  const chartRows = rows.slice(0, 12);

  if (!category || !value || !hasUsableValues(chartRows, [value])) return null;

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        type="bar"
        height={300}
        series={[{ name: columns.find((column) => column.key === value)?.label || "Value", data: chartRows.map((row) => Number(row[value] || 0)) }]}
        options={{
          chart: { toolbar: { show: false }, fontFamily: "inherit" },
          colors: ["#70B56A"],
          plotOptions: { bar: { borderRadius: 6, columnWidth: "42%" } },
          dataLabels: { enabled: false },
          grid: { borderColor: "#DCE7DB" },
          xaxis: { categories: chartRows.map((row) => formatChartCategory(row[category], category, columns)), labels: { rotate: -35, trim: true } },
          yaxis: { labels: { formatter: (amount) => formatReportValue(amount, columns.find((column) => column.key === value)?.type, currency) } },
          tooltip: { y: { formatter: (amount) => formatReportValue(amount, columns.find((column) => column.key === value)?.type, currency) } },
        }}
      />
    </ChartPanel>
  );
}

function LineChart({ rows, columns, title, categoryKey, valueKeys, currency, chartType = "line" }) {
  const category = categoryKey || getCategoryKey(columns);
  const keys = valueKeys || [getValueKey(columns)].filter(Boolean);
  const chartRows = [...rows].reverse();

  if (!category || keys.length === 0 || !hasUsableValues(chartRows, keys)) return null;

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        type={chartType}
        height={300}
        series={keys.map((key) => ({
          name: columns.find((column) => column.key === key)?.label || key,
          data: chartRows.map((row) => Number(row[key] || 0)),
        }))}
        options={{
          chart: { toolbar: { show: false }, fontFamily: "inherit" },
          colors: ["#70B56A", "#243922", "#7EA8BE", "#D99A5D"],
          fill: chartType === "area" ? { type: "gradient", gradient: { shadeIntensity: 0.2, opacityFrom: 0.35, opacityTo: 0.05 } } : undefined,
          stroke: { curve: "smooth", width: 3 },
          dataLabels: { enabled: false },
          grid: { borderColor: "#DCE7DB" },
          xaxis: { categories: chartRows.map((row) => formatChartCategory(row[category], category, columns)) },
          yaxis: { labels: { formatter: (amount) => formatReportValue(amount, columns.find((column) => column.key === keys[0])?.type, currency) } },
          tooltip: { y: { formatter: (amount) => formatReportValue(amount, columns.find((column) => column.key === keys[0])?.type, currency) } },
        }}
      />
    </ChartPanel>
  );
}

function PieChart({ rows, columns, title, labelKey, valueKey, currency }) {
  const label = labelKey || getCategoryKey(columns);
  const value = valueKey || getValueKey(columns);

  if (!label || !value || !hasUsableValues(rows, [value])) return null;

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        type="donut"
        height={300}
        series={rows.map((row) => Number(row[value] || 0))}
        options={{
          chart: { toolbar: { show: false }, fontFamily: "inherit" },
          colors: ["#70B56A", "#243922", "#7EA8BE", "#D99A5D", "#C76D7E", "#8CA86A", "#9C8AC7"],
          labels: rows.map((row) => String(row[label] ?? "-")),
          legend: { position: "bottom" },
          dataLabels: { enabled: false },
          tooltip: { y: { formatter: (amount) => formatReportValue(amount, columns.find((column) => column.key === value)?.type, currency) } },
        }}
      />
    </ChartPanel>
  );
}

function HeatmapChart({ rows, columns, title, xKey, yKey, valueKey, currency }) {
  if (!xKey || !yKey || !valueKey || !hasUsableValues(rows, [valueKey])) return null;

  const valueColumn = columns.find((column) => column.key === valueKey);
  const series = makeMatrixSeries(rows, xKey, yKey, valueKey, columns);

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        type="heatmap"
        height={320}
        series={series}
        options={{
          chart: { toolbar: { show: false }, fontFamily: "inherit" },
          colors: ["#70B56A"],
          dataLabels: { enabled: false },
          plotOptions: {
            heatmap: {
              radius: 4,
              shadeIntensity: 0.55,
              colorScale: {
                ranges: [
                  { from: 0, to: 0, color: "#ECF1EB", name: "None" },
                  { from: 1, to: 5, color: "#B9DBB5", name: "Low" },
                  { from: 6, to: 25, color: "#70B56A", name: "Medium" },
                  { from: 26, to: 100000000, color: "#243922", name: "High" },
                ],
              },
            },
          },
          tooltip: { y: { formatter: (amount) => formatReportValue(amount, valueColumn?.type, currency) } },
          xaxis: { labels: { rotate: -35, trim: true } },
        }}
      />
    </ChartPanel>
  );
}

function TreemapChart({ rows, columns, title, labelKey, valueKey, currency }) {
  if (!labelKey || !valueKey || !hasUsableValues(rows, [valueKey])) return null;
  const valueColumn = columns.find((column) => column.key === valueKey);

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        type="treemap"
        height={320}
        series={[{
          data: rows.slice(0, 24).map((row) => ({
            x: String(row[labelKey] ?? "-"),
            y: Number(row[valueKey] || 0),
          })),
        }]}
        options={{
          chart: { toolbar: { show: false }, fontFamily: "inherit" },
          colors: ["#70B56A", "#243922", "#7EA8BE", "#D99A5D", "#C76D7E", "#8CA86A"],
          legend: { show: false },
          dataLabels: { enabled: true, style: { fontSize: "12px" } },
          tooltip: { y: { formatter: (amount) => formatReportValue(amount, valueColumn?.type, currency) } },
        }}
      />
    </ChartPanel>
  );
}

function RadarChart({ title, metrics }) {
  const chartMetrics = metrics.filter((metric) => Number.isFinite(Number(metric.value)) && Number(metric.value) !== 0);
  if (chartMetrics.length === 0) return null;

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        type="radar"
        height={320}
        series={[{ name: "Score", data: chartMetrics.map((metric) => Number(metric.value || 0)) }]}
        options={{
          chart: { toolbar: { show: false }, fontFamily: "inherit" },
          colors: ["#70B56A"],
          labels: chartMetrics.map((metric) => metric.label),
          yaxis: { min: 0, max: 10, tickAmount: 5 },
          markers: { size: 4 },
          fill: { opacity: 0.2 },
        }}
      />
    </ChartPanel>
  );
}

function ChartGrid({ children }) {
  const visibleChildren = React.Children.toArray(children).filter((child) => {
    if (!React.isValidElement(child)) return Boolean(child);

    const { rows = [], columns = [], categoryKey, valueKey, valueKeys, labelKey, xKey, yKey, metrics = [] } = child.props || {};

    if (child.type === BarChart) {
      const category = categoryKey || getCategoryKey(columns);
      const value = valueKey || getValueKey(columns);
      return Boolean(category && value && hasUsableValues(rows.slice(0, 12), [value]));
    }

    if (child.type === LineChart) {
      const category = categoryKey || getCategoryKey(columns);
      const keys = valueKeys || [getValueKey(columns)].filter(Boolean);
      return Boolean(category && keys.length > 0 && hasUsableValues(rows, keys));
    }

    if (child.type === PieChart) {
      const label = labelKey || getCategoryKey(columns);
      const value = valueKey || getValueKey(columns);
      return Boolean(label && value && hasUsableValues(rows, [value]));
    }

    if (child.type === HeatmapChart) {
      return Boolean(xKey && yKey && valueKey && hasUsableValues(rows, [valueKey]));
    }

    if (child.type === TreemapChart) {
      return Boolean(labelKey && valueKey && hasUsableValues(rows, [valueKey]));
    }

    if (child.type === RadarChart) {
      return metrics.some((metric) => Number.isFinite(Number(metric.value)) && Number(metric.value) !== 0);
    }

    return true;
  });
  if (visibleChildren.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
      {visibleChildren}
    </div>
  );
}

function GenericReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      {rows.length > 0 && (
        <BarChart rows={rows} columns={columns} title={`${data.title} Snapshot`} currency={currency} />
      )}
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function SalesReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);
  const categoryKey = pickColumn(columns, ["date", "month", "hour", "order_type", "table_title", "item", "category", "created_at", "invoice_id"]);
  const valueKeys = availableKeys(columns, ["revenue", "net_sales", "gross_sales", "total", "average_order_value"]);
  const hasHour = columns.some((column) => column.key === "hour");
  const hasOrderType = columns.some((column) => column.key === "order_type");
  const hasTable = columns.some((column) => column.key === "table_title");

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <LineChart rows={rows} columns={columns} title="Sales Trend" categoryKey={categoryKey} valueKeys={valueKeys} currency={currency} chartType="area" />
        <BarChart rows={rows} columns={columns} title="Sales Breakdown" categoryKey={categoryKey} valueKey={pickColumn(columns, ["revenue", "gross_sales", "total", "net_sales"])} currency={currency} />
        {hasHour && <HeatmapChart rows={rows} columns={columns} title="Hourly Sales Heatmap" xKey="hour" yKey="hour" valueKey="revenue" currency={currency} />}
        {hasOrderType && <PieChart rows={rows} columns={columns} title="Revenue by Order Type" labelKey="order_type" valueKey="revenue" currency={currency} />}
        {hasTable && <TreemapChart rows={rows} columns={columns} title="Table Revenue Map" labelKey="table_title" valueKey="revenue" currency={currency} />}
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function PaymentReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);
  const labelKey = pickColumn(columns, ["payment_type", "date", "created_at", "order_type", "customer"]);
  const valueKey = pickColumn(columns, ["total", "estimated_total", "invoice_count"]);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        {columns.some((column) => column.key === "payment_type") && <PieChart rows={rows} columns={columns} title="Payment Mix" labelKey="payment_type" valueKey={valueKey} currency={currency} />}
        <BarChart rows={rows} columns={columns} title="Payment Volume" categoryKey={labelKey} valueKey={valueKey} currency={currency} />
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function PaymentMethodProgressPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const groupedRows = groupRowsByDate(rows);
  const groupedColumns = [
    { key: "date", label: "Date", type: "date" },
    { key: "total", label: "Total", type: "money" },
    { key: "invoices", label: "Invoices", type: "number" },
  ];

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <LineChart rows={groupedRows} columns={groupedColumns} title={`${data.title} Amount Progress`} categoryKey="date" valueKeys={["total"]} currency={currency} chartType="area" />
        <BarChart rows={groupedRows} columns={groupedColumns} title={`${data.title} Transactions by Date`} categoryKey="date" valueKey="invoices" currency={currency} />
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function MenuReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);
  const labelKey = pickColumn(columns, ["item", "category", "variant", "addon", "type"]);
  const primaryValueKey = pickColumn(columns, ["gross_sales", "addon_sales", "quantity_sold", "price"]);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <BarChart rows={rows} columns={columns} title="Menu Performance" categoryKey={labelKey} valueKey={primaryValueKey} currency={currency} />
        <TreemapChart rows={rows} columns={columns} title="Revenue Contribution Map" labelKey={labelKey} valueKey={primaryValueKey} currency={currency} />
        <BarChart rows={rows} columns={columns} title="Quantity Movement" categoryKey={labelKey} valueKey={pickColumn(columns, ["quantity_sold", "order_lines"])} currency={currency} />
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function InventoryReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <BarChart rows={rows} columns={columns} title="Inventory Quantity View" categoryKey={pickColumn(columns, ["title", "item", "inventory_item"])} valueKey={pickColumn(columns, ["reorder_quantity", "quantity", "quantity_change", "wasted_quantity", "estimated_usage"])} currency={currency} />
        <TreemapChart rows={rows} columns={columns} title="Stock Pressure Map" labelKey={pickColumn(columns, ["title", "item", "inventory_item"])} valueKey={pickColumn(columns, ["reorder_quantity", "wasted_quantity", "estimated_usage", "quantity"])} currency={currency} />
        {columns.some((column) => column.key === "movement_type") && <HeatmapChart rows={rows} columns={columns} title="Movement Heatmap" xKey="created_at" yKey="movement_type" valueKey="quantity_change" currency={currency} />}
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function CustomerReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);
  const labelKey = pickColumn(columns, ["name", "customer", "membership", "created_at", "phone"]);
  const activityValueKey = pickColumn(columns, ["revenue", "orders", "days_until_birthday"]);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <BarChart rows={rows} columns={columns} title="Customer Activity" categoryKey={labelKey} valueKey={activityValueKey} currency={currency} />
        <BarChart rows={rows} columns={columns} title="Customer Order Volume" categoryKey={labelKey} valueKey={pickColumn(columns, ["orders"])} currency={currency} />
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function OperationsReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);
  const hasStatusAndPayment = columns.some((column) => column.key === "status") && columns.some((column) => column.key === "payment_status");

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <BarChart rows={rows} columns={columns} title="Operational Volume" categoryKey={pickColumn(columns, ["status", "table_title", "staff_name", "date", "token_no", "order_type"])} valueKey={pickColumn(columns, ["orders", "quantity", "item_lines", "revenue", "estimated_total"])} currency={currency} />
        {hasStatusAndPayment && <HeatmapChart rows={rows} columns={columns} title="Status and Payment Heatmap" xKey="status" yKey="payment_status" valueKey="orders" currency={currency} />}
        {columns.some((column) => column.key === "table_title") && <TreemapChart rows={rows} columns={columns} title="Table Activity Map" labelKey="table_title" valueKey={pickColumn(columns, ["orders", "revenue", "estimated_total"])} currency={currency} />}
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function AccountingReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <LineChart rows={rows} columns={columns} title="Accounting Trend" categoryKey={pickColumn(columns, ["date", "created_at"])} valueKeys={["revenue", "tax_total", "service_charge_total", "total"].filter((key) => columns.some((column) => column.key === key))} currency={currency} chartType="area" />
        <BarChart rows={rows} columns={columns} title="Accounting Breakdown" categoryKey={pickColumn(columns, ["date", "tax", "item", "invoice_id"])} valueKey={pickColumn(columns, ["tax_total", "estimated_tax", "service_charge_total", "total", "revenue"])} currency={currency} />
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function ReservationReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <BarChart rows={rows} columns={columns} title="Reservation Volume" categoryKey={pickColumn(columns, ["status", "date", "table_title"])} valueKey={pickColumn(columns, ["reservations", "people_count", "guests"])} currency={currency} />
        {columns.some((column) => column.key === "table_title") && <HeatmapChart rows={rows} columns={columns} title="Reservation Heatmap" xKey={pickColumn(columns, ["status", "date"])} yKey="table_title" valueKey={pickColumn(columns, ["reservations", "people_count"])} currency={currency} />}
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

function FeedbackReportPage({ data, currency, components }) {
  const { SummaryGrid, DataTable } = components;
  const rows = getRows(data);
  const columns = getColumns(data);
  const ratingMetrics = ["average_rating", "food_quality_rating", "service_rating", "staff_behavior_rating", "ambiance_rating", "recommend_rating"]
    .filter((key) => rows.some((row) => row[key] != null))
    .map((key) => ({
      label: columns.find((column) => column.key === key)?.label || key,
      value: rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0,
    }));

  return (
    <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SummaryGrid summary={data.summary} currency={currency} />
      <ChartGrid>
        <LineChart rows={rows} columns={columns} title="Feedback Scores" categoryKey={pickColumn(columns, ["date", "recommendation_group"])} valueKeys={["average_rating", "service_rating", "recommend_rating", "feedback_count"].filter((key) => columns.some((column) => column.key === key))} currency={currency} />
        {ratingMetrics.length > 0 && <RadarChart title="Rating Dimension Radar" metrics={ratingMetrics} />}
        {columns.some((column) => column.key === "recommendation_group") && <PieChart rows={rows} columns={columns} title="Recommendation Mix" labelKey="recommendation_group" valueKey="feedback_count" currency={currency} />}
      </ChartGrid>
      {(data.tables || []).map((table) => (
        <DataTable key={table.title} table={table} currency={currency} />
      ))}
    </div>
  );
}

const REPORT_PAGE_COMPONENTS = {
  "sales-summary": SalesReportPage,
  "gross-sales": SalesReportPage,
  "net-sales": SalesReportPage,
  "sales-by-hour": SalesReportPage,
  "sales-by-day": SalesReportPage,
  "sales-by-month": SalesReportPage,
  "sales-by-order-type": SalesReportPage,
  "sales-by-table": SalesReportPage,
  "invoice-detail": SalesReportPage,
  "voids-cancellations": SalesReportPage,
  "average-order-value": SalesReportPage,
  "payment-summary": PaymentReportPage,
  "cash-report": PaymentMethodProgressPage,
  "card-report": PaymentMethodProgressPage,
  "unpaid-orders": PaymentReportPage,
  "payment-type-mix": PaymentReportPage,
  "top-selling-items": MenuReportPage,
  "low-selling-items": MenuReportPage,
  "item-sales": MenuReportPage,
  "category-sales": MenuReportPage,
  "variant-sales": MenuReportPage,
  "addon-sales": MenuReportPage,
  "menu-price-audit": MenuReportPage,
  "customer-summary": CustomerReportPage,
  "new-customers": CustomerReportPage,
  "returning-customers": CustomerReportPage,
  "top-customers": CustomerReportPage,
  "customer-birthdays": CustomerReportPage,
  "member-customers": CustomerReportPage,
  "order-status": OperationsReportPage,
  "kitchen-performance": OperationsReportPage,
  "token-report": OperationsReportPage,
  "qr-order-report": OperationsReportPage,
  "table-turnover": OperationsReportPage,
  "staff-created-orders": OperationsReportPage,
  "inventory-summary": InventoryReportPage,
  "low-stock": InventoryReportPage,
  "stock-movements": InventoryReportPage,
  "wastage": InventoryReportPage,
  "recipe-usage": InventoryReportPage,
  "stock-reorder": InventoryReportPage,
  "tax-summary": AccountingReportPage,
  "tax-by-item": AccountingReportPage,
  "service-charge": AccountingReportPage,
  "daily-close": AccountingReportPage,
  "invoice-register": AccountingReportPage,
  "reservation-summary": ReservationReportPage,
  "upcoming-reservations": ReservationReportPage,
  "reservation-no-show": ReservationReportPage,
  "feedback-summary": FeedbackReportPage,
  "negative-feedback": FeedbackReportPage,
  "recommendation-score": FeedbackReportPage,
};

export function getReportPageComponent(reportId) {
  return REPORT_PAGE_COMPONENTS[reportId] || GenericReportPage;
}

export { GenericReportPage };
