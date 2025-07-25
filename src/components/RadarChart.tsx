import React from "react";
import { RadarChartData } from "../lib/types";

interface RadarChartProps {
  data: RadarChartData;
  size?: number;
  showLabels?: boolean;
}

export function RadarChart({
  data,
  size = 300,
  showLabels = true,
}: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.35;
  const labelRadius = size * 0.42;

  const angleStep = (2 * Math.PI) / data.metrics.length;

  const getPoint = (index: number, value: number, maxValue: number = 2) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 1) * radius * 0.5; // Scale so 1.0 = 50% radius, 2.0 = 100% radius
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    };
  };

  const getCirclePoints = (radiusPercent: number) => {
    const r = radius * radiusPercent;
    return Array.from({ length: data.metrics.length }, (_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      };
    });
  };

  const dataPoints = data.metrics.map((metric, index) =>
    getPoint(index, metric.value, metric.maxValue),
  );

  const pathData =
    dataPoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ") + " Z";

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{data.title}</h3>
        {data.subtitle && (
          <p className="text-sm text-gray-600">{data.subtitle}</p>
        )}
      </div>

      <div className="flex justify-center">
        <svg width={size} height={size} className="overflow-visible">
          {/* Grid circles */}
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((radiusPercent, index) => {
            const points = getCirclePoints(radiusPercent);
            const pathData =
              points
                .map(
                  (point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                )
                .join(" ") + " Z";

            return (
              <path
                key={index}
                d={pathData}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="1"
                opacity={0.5}
              />
            );
          })}

          {/* Grid lines */}
          {data.metrics.map((_, index) => {
            const outer = getPoint(index, 2, 2);
            return (
              <line
                key={index}
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="#e5e7eb"
                strokeWidth="1"
                opacity={0.5}
              />
            );
          })}

          {/* Data area */}
          <path
            d={pathData}
            fill={data.metrics[0]?.color || "#3b82f6"}
            fillOpacity={0.2}
            stroke={data.metrics[0]?.color || "#3b82f6"}
            strokeWidth="2"
          />

          {/* Data points */}
          {dataPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={data.metrics[index]?.color || "#3b82f6"}
              stroke="white"
              strokeWidth="2"
            />
          ))}

          {/* Labels */}
          {showLabels &&
            data.metrics.map((metric, index) => {
              const labelPoint = getLabelPoint(index);
              const isRightSide = labelPoint.x > center;
              const isTop = labelPoint.y < center - 10;
              const isBottom = labelPoint.y > center + 10;

              let textAnchor: string;
              if (Math.abs(labelPoint.x - center) < 10) {
                textAnchor = "middle";
              } else {
                textAnchor = isRightSide ? "start" : "end";
              }

              let dominantBaseline: string;
              if (isTop) {
                dominantBaseline = "auto";
              } else if (isBottom) {
                dominantBaseline = "hanging";
              } else {
                dominantBaseline = "central";
              }

              return (
                <text
                  key={index}
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={textAnchor}
                  dominantBaseline={dominantBaseline}
                  className="text-xs fill-gray-600 font-medium"
                  style={{ fontSize: "11px" }}
                >
                  {metric.label}
                </text>
              );
            })}

          {/* Value labels */}
          {[0.5, 1.0, 1.5, 2.0].map((value, index) => (
            <text
              key={index}
              x={center + 5}
              y={center - (value / 2) * radius}
              className="text-xs fill-gray-400"
              style={{ fontSize: "10px" }}
            >
              {value}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
