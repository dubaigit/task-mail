"use client";

import React, { useState } from "react";
import { ModernButton } from "../ui/ModernButton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/Avatar";
import { Badge } from "../ui/SimpleComponents";
import { ScrollArea } from "../ui/ScrollArea";
import { Separator } from "../ui/Separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Bell,
  Calendar,
  FileText,
  BarChart3,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface Task {
  id: string;
  title: string;
  column: "backlog" | "todo" | "doing" | "done";
}

const TaskCentricDashboard: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "Design new landing page", column: "backlog" },
    { id: "2", title: "Implement user authentication", column: "todo" },
    { id: "3", title: "Fix responsive layout issues", column: "doing" },
    { id: "4", title: "Write API documentation", column: "done" },
  ]);

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className={cn("lg:block", isMobileMenuOpen ? "block" : "hidden")}>
        <div
          className={cn(
            "fixed left-0 top-0 h-full bg-background border-r border-border z-40 flex flex-col",
            isCollapsed ? "w-20" : "w-72"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!isCollapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">T</span>
                </div>
                <div>
                  <h1 className="font-semibold text-foreground">TaskFlow</h1>
                  <p className="text-xs text-muted-foreground">Project Management</p>
                </div>
              </div>
            )}
            <ModernButton
              variant="secondary"
              
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </ModernButton>
          </div>
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-1 py-2">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
                <LayoutDashboard className="h-4 w-4" />
                {!isCollapsed && <span>Dashboard</span>}
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
                <Users className="h-4 w-4" />
                {!isCollapsed && <span>Team</span>}
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted">
                <FileText className="h-4 w-4" />
                {!isCollapsed && <span>Projects</span>}
              </button>
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ModernButton variant="secondary" className="w-full justify-start p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="ml-3 flex-1 text-left">
                      <p className="text-sm font-medium">John Doe</p>
                      <p className="text-xs text-muted-foreground">john@example.com</p>
                    </div>
                  )}
                  {!isCollapsed && <ChevronsUpDown className="h-4 w-4 ml-auto" />}
                </ModernButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-72">
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <ModernButton
              variant="secondary"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </ModernButton>
            <h1 className="text-xl font-semibold">Project Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <ModernButton variant="secondary">
              <Bell className="h-4 w-4" />
            </ModernButton>
            <ModernButton>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </ModernButton>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Tasks", value: tasks.length },
              { label: "In Progress", value: tasks.filter(t => t.column === "doing").length },
              { label: "Completed", value: tasks.filter(t => t.column === "done").length },
              { label: "Backlog", value: tasks.filter(t => t.column === "backlog").length },
            ].map((stat, index) => (
              <div key={index} className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-card border border-border rounded-lg p-4">
                <p className="font-medium">{task.title}</p>
                <Badge variant="secondary">{task.column}</Badge>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TaskCentricDashboard;
