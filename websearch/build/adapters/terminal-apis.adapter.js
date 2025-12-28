import { z } from "zod";
import { spawn } from "child_process";
// Store active terminals keyed by PID (stringified)
const activeTerminals = new Map();
// Store terminal sessions keyed by PID as string
const terminalSessions = new Map();
// Create Terminal Tool
const createTerminalTool = {
    name: "create_terminal",
    description: "Create a new terminal session",
    schema: {
        command: z.string().min(1).describe("Command to run in the terminal"),
        cwd: z.string().optional().describe("Working directory (defaults to current directory)"),
        shell: z.string().default('/bin/bash').describe("Shell to use (e.g., /bin/bash, cmd.exe)"),
        timeout: z.number().min(1).max(300).default(60).describe("Timeout in seconds (1-300)"),
        background: z.boolean().default(false).describe("Run in background (don't wait for completion)")
    },
    handler: async ({ command, cwd, shell, timeout, background }) => {
        try {
            const workingDirectory = cwd || process.cwd();
            // Spawn the process
            const child = spawn(command, [], {
                shell: true,
                cwd: workingDirectory,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const pid = child.pid ?? null;
            if (pid === null) {
                child.kill('SIGTERM');
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: "Failed to obtain terminal PID",
                                message: "Could not start terminal process"
                            }, null, 2)
                        }
                    ]
                };
            }
            const pidStr = String(pid);
            // Create terminal session record
            const session = {
                pid,
                command: command,
                cwd: workingDirectory,
                status: 'running',
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                output: []
            };
            terminalSessions.set(pidStr, session);
            activeTerminals.set(pidStr, child);
            // Collect output
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                session.output.push(`[STDOUT] ${new Date().toISOString()}: ${output.trim()}`);
                session.last_updated = new Date().toISOString();
            });
            child.stderr?.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                session.output.push(`[STDERR] ${new Date().toISOString()}: ${output.trim()}`);
                session.last_updated = new Date().toISOString();
            });
            child.on('error', (error) => {
                session.status = 'error';
                session.error = error.message;
                session.last_updated = new Date().toISOString();
                activeTerminals.delete(pidStr);
            });
            child.on('close', (code) => {
                session.status = code === 0 ? 'completed' : 'error';
                session.exit_code = code;
                session.last_updated = new Date().toISOString();
                activeTerminals.delete(pidStr);
            });
            // Set timeout
            if (timeout > 0 && !background) {
                setTimeout(() => {
                    if (activeTerminals.has(pidStr)) {
                        child.kill('SIGTERM');
                        session.status = 'error';
                        session.error = `Process timed out after ${timeout} seconds`;
                        session.last_updated = new Date().toISOString();
                        activeTerminals.delete(pidStr);
                    }
                }, timeout * 1000);
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            pid,
                            command: command,
                            cwd: workingDirectory,
                            shell: shell,
                            timeout: timeout,
                            background: background,
                            status: session.status,
                            created_at: session.created_at,
                            message: background ?
                                `Terminal PID ${pid} created and running in background` :
                                `Terminal PID ${pid} created and running`
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            created_at: new Date().toISOString(),
                            message: 'Failed to create terminal session'
                        }, null, 2)
                    }
                ]
            };
        }
    }
};
// Run Terminal Tool
const runTerminalTool = {
    name: "run_terminal",
    description: "Run a command in a terminal (by PID) and return output",
    schema: {
        pid: z.union([z.string(), z.number()]).describe("Terminal PID"),
        command: z.string().min(1).describe("Command to run"),
        timeout: z.number().min(1).max(300).default(60).describe("Timeout in seconds (1-300)")
    },
    handler: async ({ pid, command, timeout }) => {
        try {
            const pidStr = String(pid);
            const session = terminalSessions.get(pidStr);
            if (!session) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: `Terminal PID ${pidStr} not found`,
                                available_sessions: Array.from(terminalSessions.keys()),
                                message: 'Invalid session ID'
                            }, null, 2)
                        }
                    ]
                };
            }
            if (session.status === 'running') {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: `Terminal PID ${pidStr} is already running`,
                                current_command: session.command,
                                status: session.status,
                                message: 'Wait for current command to complete'
                            }, null, 2)
                        }
                    ]
                };
            }
            // Update session
            session.command = command;
            session.status = 'running';
            session.last_updated = new Date().toISOString();
            session.output = [];
            // Spawn new process and await completion
            const child = spawn(command, [], {
                shell: true,
                cwd: session.cwd,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            activeTerminals.set(pidStr, child);
            // Collect output
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                session.output.push(`[STDOUT] ${new Date().toISOString()}: ${output.trim()}`);
                session.last_updated = new Date().toISOString();
            });
            child.stderr?.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                session.output.push(`[STDERR] ${new Date().toISOString()}: ${output.trim()}`);
                session.last_updated = new Date().toISOString();
            });
            const exitCode = await new Promise((resolve) => {
                let timedOut = false;
                let timeoutHandle = null;
                if (timeout > 0) {
                    timeoutHandle = setTimeout(() => {
                        if (activeTerminals.has(pidStr)) {
                            timedOut = true;
                            child.kill('SIGTERM');
                            session.status = 'error';
                            session.error = `Process timed out after ${timeout} seconds`;
                            session.last_updated = new Date().toISOString();
                            activeTerminals.delete(pidStr);
                            resolve(null);
                        }
                    }, timeout * 1000);
                }
                child.on('error', (error) => {
                    if (timeoutHandle)
                        clearTimeout(timeoutHandle);
                    session.status = 'error';
                    session.error = error.message;
                    session.last_updated = new Date().toISOString();
                    activeTerminals.delete(pidStr);
                    resolve(null);
                });
                child.on('close', (code) => {
                    if (timeoutHandle)
                        clearTimeout(timeoutHandle);
                    if (!timedOut) {
                        session.status = code === 0 ? 'completed' : 'error';
                        session.exit_code = code;
                        session.last_updated = new Date().toISOString();
                        activeTerminals.delete(pidStr);
                        resolve(code);
                    }
                });
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            pid: session.pid,
                            command: command,
                            cwd: session.cwd,
                            timeout: timeout,
                            status: session.status,
                            exit_code: exitCode,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            started_at: session.last_updated,
                            message: `Command finished in terminal PID ${session.pid}`
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            pid: String(pid),
                            message: 'Failed to run command in terminal'
                        }, null, 2)
                    }
                ]
            };
        }
    }
};
// Read Terminal Tool
const readTerminalTool = {
    name: "read_terminal",
    description: "Read output from a terminal (by PID)",
    schema: {
        pid: z.union([z.string(), z.number()]).describe("Terminal PID"),
        lines: z.number().min(1).max(15000).default(50).describe("Number of recent lines to show (1-15000)")
    },
    handler: async ({ pid, lines }) => {
        const pidStr = String(pid);
        try {
            const session = terminalSessions.get(pidStr);
            if (!session) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: `Terminal PID ${pidStr} not found`,
                                available_sessions: Array.from(terminalSessions.keys()),
                                message: 'Invalid PID'
                            }, null, 2)
                        }
                    ]
                };
            }
            // Get recent output lines
            const recentOutput = session.output.slice(-lines);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            pid: session.pid,
                            command: session.command,
                            cwd: session.cwd,
                            status: session.status,
                            exit_code: session.exit_code,
                            error: session.error,
                            created_at: session.created_at,
                            last_updated: session.last_updated,
                            total_output_lines: session.output.length,
                            recent_lines_shown: recentOutput.length,
                            output: recentOutput,
                            is_active: activeTerminals.has(pidStr)
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            pid: pidStr,
                            message: 'Failed to read terminal session'
                        }, null, 2)
                    }
                ]
            };
        }
    }
};
// List Terminals Tool
const listTerminalsTool = {
    name: "list_terminals",
    description: "List terminal sessions (by PID)",
    schema: {
        include_completed: z.boolean().default(true).describe("Include completed sessions"),
        limit: z.number().min(1).max(50).default(20).describe("Maximum sessions to show (1-50)")
    },
    handler: async ({ include_completed, limit }) => {
        try {
            const sessions = Array.from(terminalSessions.values());
            // Filter sessions
            const filteredSessions = include_completed ?
                sessions :
                sessions.filter(s => s.status === 'running');
            // Sort by last updated (newest first)
            const sortedSessions = filteredSessions.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
            // Limit results
            const limitedSessions = sortedSessions.slice(0, limit);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            total_sessions: sessions.length,
                            active_sessions: sessions.filter(s => s.status === 'running').length,
                            completed_sessions: sessions.filter(s => s.status === 'completed').length,
                            error_sessions: sessions.filter(s => s.status === 'error').length,
                            sessions_shown: limitedSessions.length,
                            include_completed: include_completed,
                            sessions: limitedSessions.map(session => ({
                                pid: session.pid,
                                command: session.command,
                                cwd: session.cwd,
                                status: session.status,
                                exit_code: session.exit_code,
                                created_at: session.created_at,
                                last_updated: session.last_updated,
                                output_lines: session.output.length,
                                is_active: activeTerminals.has(String(session.pid))
                            }))
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            message: 'Failed to list terminal sessions'
                        }, null, 2)
                    }
                ]
            };
        }
    }
};
// Kill Terminal Tool
const killTerminalTool = {
    name: "kill_terminal",
    description: "Kill a running terminal session",
    schema: {
        pid: z.union([z.string(), z.number()]).describe("Terminal PID"),
        signal: z.enum(['SIGTERM', 'SIGKILL']).default('SIGTERM').describe("Signal to send (SIGTERM or SIGKILL)")
    },
    handler: async ({ pid, signal }) => {
        try {
            const pidStr = String(pid);
            const session = terminalSessions.get(pidStr);
            if (!session) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: `Terminal PID ${pidStr} not found`,
                                available_sessions: Array.from(terminalSessions.keys()),
                                message: 'Invalid session ID'
                            }, null, 2)
                        }
                    ]
                };
            }
            const child = activeTerminals.get(pidStr);
            if (!child) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: `Terminal PID ${pidStr} is not running`,
                                status: session.status,
                                message: 'Cannot kill non-running session'
                            }, null, 2)
                        }
                    ]
                };
            }
            // Kill the process
            child.kill(signal);
            // Update session
            session.status = 'error';
            session.error = `Process killed with ${signal}`;
            session.last_updated = new Date().toISOString();
            activeTerminals.delete(pidStr);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            pid: session.pid,
                            signal: signal,
                            killed_at: session.last_updated,
                            command: session.command,
                            message: `Terminal PID ${pidStr} killed with ${signal}`
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            pid: String(pid),
                            message: 'Failed to kill terminal session'
                        }, null, 2)
                    }
                ]
            };
        }
    }
};
export const terminalApisAdapter = {
    name: "terminal-apis",
    description: "Terminal APIs for creating, running, and managing terminal sessions",
    tools: [
        createTerminalTool,
        runTerminalTool,
        readTerminalTool,
        listTerminalsTool,
        killTerminalTool
    ]
};
