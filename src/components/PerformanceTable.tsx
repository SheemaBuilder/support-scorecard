import React, { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { EngineerMetrics } from "../lib/types";
import { cn } from "../lib/utils";

interface PerformanceTableProps {
  data: EngineerMetrics[];
  averageData: EngineerMetrics;
}

type SortKey = keyof EngineerMetrics;
type SortOrder = "asc" | "desc" | null;

export function PerformanceTable({ data, averageData }: PerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  // Hardcoded QA, CM, RS, TC values for July 2025
  const hardcodedScores: Record<
    string,
    { qa: number; cm: number; rs: number; tc: number }
  > = {
    "Akash Singh": { qa: 7.9, cm: 8.2, rs: 8.0, tc: 7.6 },
    "Jared Beckler": { qa: 8.2, cm: 8.2, rs: 8.2, tc: 8.2 },
    "Parth Sharma": { qa: 8.1, cm: 8.4, rs: 7.9, tc: 8.1 },
    "Rahul Joshi": { qa: 8.1, cm: 8.5, rs: 7.8, tc: 8.1 },
    "Fernando Duran": { qa: 8.1, cm: 8.3, rs: 8.0, tc: 8.0 },
    "Alex Bridgeman": { qa: 8.9, cm: 8.8, rs: 8.8, tc: 9.2 },
    "Sheema Parwaz": { qa: 8.5, cm: 8.2, rs: 8.8, tc: 8.6 },
    "Manish Sharma": { qa: 8.3, cm: 8.8, rs: 8.2, tc: 8.0 },
    "Team Average": { qa: 8.3, cm: 8.4, rs: 8.2, tc: 8.2 },
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(
        sortOrder === "asc" ? "desc" : sortOrder === "desc" ? null : "asc",
      );
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey || sortOrder === null) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [data, sortKey, sortOrder]);

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key)
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    if (sortOrder === "asc")
      return <ChevronUp className="w-4 h-4 text-blue-600" />;
    if (sortOrder === "desc")
      return <ChevronDown className="w-4 h-4 text-blue-600" />;
    return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
  };

  const formatValue = (value: number | string, isPercentage = false) => {
    if (typeof value === "string") return value;
    if (value === 0) return "-"; // Show dash for no data
    if (isPercentage) return `${value.toFixed(1)}%`;
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  };

  const getCellColor = (
    value: number,
    averageValue: number,
    higherIsBetter: boolean = true,
  ) => {
    // If no data (0), show gray
    if (value === 0) {
      return "bg-gray-100 text-gray-500";
    }
    // Otherwise use performance color
    return getPerformanceColor(value, averageValue, higherIsBetter);
  };

  const getCellClassName = (value: number, isGood: boolean) => {
    if (value >= 90 && isGood) return "text-green-700 bg-green-50";
    if (value >= 80 && isGood) return "text-blue-700 bg-blue-50";
    if (value >= 70 && isGood) return "text-yellow-700 bg-yellow-50";
    if (value < 70 && isGood) return "text-red-700 bg-red-50";
    return "";
  };

  const getPerformanceColor = (
    engineerValue: number,
    averageValue: number,
    higherIsBetter: boolean = true,
  ) => {
    const ratio = engineerValue / averageValue;

    if (higherIsBetter) {
      // For metrics where higher values are better
      if (ratio >= 1.15) return "bg-green-100 text-green-800"; // 15%+ above average
      if (ratio >= 1.05) return "bg-green-50 text-green-700"; // 5-15% above average
      if (ratio >= 0.95) return "bg-yellow-50 text-yellow-700"; // Within 5% of average
      if (ratio >= 0.85) return "bg-orange-50 text-orange-700"; // 5-15% below average
      return "bg-red-100 text-red-800"; // 15%+ below average
    } else {
      // For metrics where lower values are better (invert the logic)
      if (ratio <= 0.85) return "bg-green-100 text-green-800"; // 15%+ below average (good)
      if (ratio <= 0.95) return "bg-green-50 text-green-700"; // 5-15% below average (good)
      if (ratio <= 1.05) return "bg-yellow-50 text-yellow-700"; // Within 5% of average
      if (ratio <= 1.15) return "bg-orange-50 text-orange-700"; // 5-15% above average (bad)
      return "bg-red-100 text-red-800"; // 15%+ above average (bad)
    }
  };

  // Specialized color function for QA, CM, RS, TC scores (range 7.6-9.2)
  const getScoreColor = (score: number) => {
    if (score >= 8.7) return "bg-emerald-100 text-emerald-800"; // Excellent (8.7+)
    if (score >= 8.4) return "bg-green-100 text-green-800"; // Very Good (8.4-8.6)
    if (score >= 8.1) return "bg-blue-100 text-blue-800"; // Good (8.1-8.3)
    if (score >= 7.8) return "bg-yellow-100 text-yellow-800"; // Average (7.8-8.0)
    return "bg-orange-100 text-orange-800"; // Below Average (7.6-7.7)
  };

  const TableHeader = ({
    children,
    sortKey: key,
    className = "",
    title,
  }: {
    children: React.ReactNode;
    sortKey?: SortKey;
    className?: string;
    title?: string;
  }) => (
    <th
      className={cn(
        "px-0.5 py-0.5 text-center text-xs font-medium text-gray-700 uppercase tracking-tighter bg-gray-100 border-b border-gray-200 leading-tight",
        key && "cursor-pointer hover:bg-gray-200 select-none",
        className,
      )}
      style={{ fontSize: "10px" }}
      title={title}
      onClick={key ? () => handleSort(key) : undefined}
    >
      <div className="flex items-center justify-center space-x-0.5">
        <span>{children}</span>
        {key && getSortIcon(key)}
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div>
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead>
            <tr>
              <TableHeader
                sortKey="name"
                className="w-20"
                title="Engineer Name"
              >
                Name
              </TableHeader>
              <TableHeader
                sortKey="cesPercent"
                className="w-8 bg-blue-100"
                title="Customer Effort Score %"
              >
                CES
              </TableHeader>
              <TableHeader
                sortKey="surveyCount"
                className="w-8 bg-blue-100"
                title="Survey Response Count"
              >
                SC
              </TableHeader>
              <TableHeader
                sortKey="closed"
                className="w-8 bg-purple-100"
                title="Closed Tickets"
              >
                Cl
              </TableHeader>
              <TableHeader
                sortKey="avgPcc"
                className="w-8 bg-purple-100"
                title="Average Resolution Time (Days)"
              >
                Tm
              </TableHeader>
              <TableHeader
                sortKey="closedLessThan7"
                className="w-8 bg-purple-100"
                title="Closed in 3-14 Days (72-336 hours)"
              >
                CL_14
              </TableHeader>
              <TableHeader
                sortKey="closedEqual1"
                className="w-8 bg-purple-100"
                title="Closed in 0-3 Days (0-72 hours)"
              >
                CL_3
              </TableHeader>

              <TableHeader
                className="w-8 bg-green-100"
                title="Overall Quality Score"
              >
                QA
              </TableHeader>
              <TableHeader
                className="w-8 bg-green-100"
                title="Communication Score"
              >
                Cm
              </TableHeader>
              <TableHeader
                className="w-8 bg-green-100"
                title="Quality of Responses Score"
              >
                Rs
              </TableHeader>
              <TableHeader
                className="w-8 bg-green-100"
                title="Technical Accuracy Score"
              >
                Tc
              </TableHeader>
              <TableHeader
                sortKey="enterprisePercent"
                className="w-8 bg-blue-100"
                title="Enterprise Tickets %"
              >
                En
              </TableHeader>
              <TableHeader
                sortKey="technicalPercent"
                className="w-8 bg-blue-100"
                title="Technical Tickets %"
              >
                Tl
              </TableHeader>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedData.map((engineer, index) => (
              <tr
                key={engineer.name}
                className="hover:bg-gray-50 transition-colors"
              >
                <td
                  className="px-0.5 py-0.5 text-xs font-medium text-gray-900 bg-gray-50"
                  style={{ fontSize: "10px" }}
                >
                  {engineer.name}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.cesPercent,
                      averageData.cesPercent,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.cesPercent, true)}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.surveyCount,
                      averageData.surveyCount,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.surveyCount)}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(engineer.closed, averageData.closed, true),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.closed)}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.avgPcc / 24,
                      averageData.avgPcc / 24,
                      false,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.avgPcc / 24)}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.closedLessThan7,
                      averageData.closedLessThan7,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.closedLessThan7, true)}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.closedEqual1,
                      averageData.closedEqual1,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.closedEqual1, true)}
                </td>

                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    hardcodedScores[engineer.name]?.qa
                      ? getScoreColor(hardcodedScores[engineer.name].qa)
                      : "bg-gray-100 text-gray-500",
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {hardcodedScores[engineer.name]?.qa
                    ? formatValue(hardcodedScores[engineer.name].qa)
                    : "-"}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      hardcodedScores[engineer.name]?.cm || 0,
                      hardcodedScores["Team Average"]?.cm || 8.4,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {hardcodedScores[engineer.name]?.cm
                    ? formatValue(hardcodedScores[engineer.name].cm)
                    : "-"}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      hardcodedScores[engineer.name]?.rs || 0,
                      hardcodedScores["Team Average"]?.rs || 8.2,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {hardcodedScores[engineer.name]?.rs
                    ? formatValue(hardcodedScores[engineer.name].rs)
                    : "-"}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      hardcodedScores[engineer.name]?.tc || 0,
                      hardcodedScores["Team Average"]?.tc || 8.2,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {hardcodedScores[engineer.name]?.tc
                    ? formatValue(hardcodedScores[engineer.name].tc)
                    : "-"}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.enterprisePercent,
                      averageData.enterprisePercent,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.enterprisePercent, true)}
                </td>
                <td
                  className={cn(
                    "px-0.5 py-0.5 text-xs text-center font-medium",
                    getCellColor(
                      engineer.technicalPercent,
                      averageData.technicalPercent,
                      true,
                    ),
                  )}
                  style={{ fontSize: "10px" }}
                >
                  {formatValue(engineer.technicalPercent, true)}
                </td>
              </tr>
            ))}
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td
                className="px-0.5 py-0.5 text-xs font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {averageData.name}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.cesPercent, true)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.surveyCount)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.closed)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.avgPcc / 24)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.closedLessThan7, true)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.closedEqual1, true)}
              </td>

              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(hardcodedScores["Team Average"]?.qa || 8.3)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(hardcodedScores["Team Average"]?.cm || 8.4)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(hardcodedScores["Team Average"]?.rs || 8.2)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(hardcodedScores["Team Average"]?.tc || 8.2)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.enterprisePercent, true)}
              </td>
              <td
                className="px-0.5 py-0.5 text-xs text-center font-bold text-blue-900"
                style={{ fontSize: "10px" }}
              >
                {formatValue(averageData.technicalPercent, true)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
