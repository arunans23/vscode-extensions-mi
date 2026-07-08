/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as vscode from 'vscode';
import { performance } from 'perf_hooks';

/**
 * Lightweight startup-performance tracer.
 *
 * Records named marks and spans relative to extension-module load time and
 * prints a timeline to the "MI: Startup Performance" output channel so
 * startup lag can be measured quantitatively across runs.
 */

const moduleLoadTime = performance.now();

interface PerfEvent {
    name: string;
    /** ms since extension module load */
    at: number;
    /** span duration in ms; undefined for point marks */
    duration?: number;
}

const events: PerfEvent[] = [];
const openSpans = new Map<string, number>();

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
    if (!channel) {
        channel = vscode.window.createOutputChannel('MI: Startup Performance');
    }
    return channel;
}

function log(line: string) {
    getChannel().appendLine(line);
    console.log(`[MI-PERF] ${line}`);
}

/** Record a point-in-time mark. */
export function perfMark(name: string) {
    const at = performance.now() - moduleLoadTime;
    events.push({ name, at });
    log(`${at.toFixed(0).padStart(8)}ms  ● ${name}`);
}

/** Start a named span. Pair with perfEnd(name). */
export function perfStart(name: string) {
    openSpans.set(name, performance.now());
    const at = performance.now() - moduleLoadTime;
    log(`${at.toFixed(0).padStart(8)}ms  ▶ ${name}…`);
}

/** End a named span started with perfStart(name). */
export function perfEnd(name: string) {
    const start = openSpans.get(name);
    if (start === undefined) {
        return;
    }
    openSpans.delete(name);
    const now = performance.now();
    const at = now - moduleLoadTime;
    const duration = now - start;
    events.push({ name, at, duration });
    log(`${at.toFixed(0).padStart(8)}ms  ■ ${name} took ${duration.toFixed(0)}ms`);
}

/** Time an async function as a span. */
export async function perfSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    perfStart(name);
    try {
        return await fn();
    } finally {
        perfEnd(name);
    }
}

/** Dump a summary table of all recorded events (sorted by time). */
export function perfSummary() {
    const ch = getChannel();
    ch.appendLine('');
    ch.appendLine('=== MI Startup Performance Summary ===');
    ch.appendLine('   at(ms)   duration(ms)  event');
    for (const e of [...events].sort((a, b) => a.at - b.at)) {
        ch.appendLine(
            `${e.at.toFixed(0).padStart(9)}   ${e.duration !== undefined ? e.duration.toFixed(0).padStart(12) : ''.padStart(12)}  ${e.name}`
        );
    }
    ch.appendLine('======================================');
}
