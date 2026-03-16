"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
	date: string;
	count: number;
	bytes?: number;
}

export function StorageChart({ data }: { data: DataPoint[] }) {
	return (
		<Card data-spotlight-card>
			<CardHeader>
				<CardTitle className="text-sm font-medium text-muted-foreground">
					Upload Volume (30d)
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={data}>
						<defs>
							<linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
								<stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
							</linearGradient>
						</defs>
						<XAxis
							dataKey="date"
							tick={{ fontSize: 11, fill: "#64748b" }}
							axisLine={false}
							tickLine={false}
						/>
						<YAxis hide />
						<Tooltip
							contentStyle={{
								background: "#1e293b",
								border: "1px solid #334155",
								borderRadius: "8px",
								fontSize: "12px",
							}}
						/>
						<Area
							type="monotone"
							dataKey="count"
							stroke="#3b82f6"
							fill="url(#uploadGrad)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
