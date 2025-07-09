import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  className,
  color = "blue",
}: MetricCardProps) {
  const colorClasses = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    yellow: "border-yellow-200 bg-yellow-50",
    red: "border-red-200 bg-red-50",
    purple: "border-purple-200 bg-purple-50",
  };

  const textColorClasses = {
    blue: "text-blue-900",
    green: "text-green-900",
    yellow: "text-yellow-900",
    red: "text-red-900",
    purple: "text-purple-900",
  };

  const subtitleColorClasses = {
    blue: "text-blue-700",
    green: "text-green-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
    purple: "text-purple-700",
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case "neutral":
        return <Minus className="w-4 h-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getTrendTextColor = () => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      case "neutral":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-6 transition-all hover:shadow-md",
        colorClasses[color],
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            {title}
          </h3>
          <p className={cn("mt-2 text-3xl font-bold", textColorClasses[color])}>
            {value}
          </p>
          {subtitle && (
            <p className={cn("mt-1 text-sm", subtitleColorClasses[color])}>
              {subtitle}
            </p>
          )}
        </div>

        {(trend || trendValue) && (
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            {trendValue && (
              <span className={cn("text-sm font-medium", getTrendTextColor())}>
                {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
