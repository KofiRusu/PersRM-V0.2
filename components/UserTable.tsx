import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Search,
  SlidersHorizontal,
} from "lucide-react";

// Define User type based on the API schema
export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
};

// Define props for the UserTable component
export interface UserTableProps {
  users: User[];
  isLoading?: boolean;
  onUserClick?: (user: User) => void;
  onEditUser?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
  className?: string;
}

// Role badge styling configuration
const roleBadgeConfig: Record<User['role'], { color: string; label: string }> = {
  admin: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", label: "Admin" },
  user: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", label: "User" },
  guest: { color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400", label: "Guest" },
};

export function UserTable({
  users,
  isLoading = false,
  onUserClick,
  onEditUser,
  onDeleteUser,
  className = "",
}: UserTableProps) {
  // State for sorting
  const [sortField, setSortField] = useState<keyof User>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // State for filtering/search
  const [searchTerm, setSearchTerm] = useState("");
  
  // Sort users based on current sort field and direction
  const sortedUsers = [...users].sort((a, b) => {
    if (a[sortField] < b[sortField]) return sortDirection === "asc" ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  
  // Filter users based on search term
  const filteredUsers = sortedUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Handle sort column click
  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Render sort indicator
  const renderSortIndicator = (field: keyof User) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-8 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>
      
      {/* Responsive table with horizontal scroll on small screens */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-[100px] cursor-pointer"
                  onClick={() => handleSort("id")}
                >
                  <div className="flex items-center">
                    ID {renderSortIndicator("id")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Name {renderSortIndicator("name")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center">
                    Email {renderSortIndicator("email")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex items-center">
                    Role {renderSortIndicator("role")}
                  </div>
                </TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className={onUserClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={onUserClick ? () => onUserClick(user) : undefined}
                  >
                    <TableCell className="font-mono text-sm">{user.id}</TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${roleBadgeConfig[user.role].color}`}
                      >
                        {roleBadgeConfig[user.role].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditUser?.(user);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteUser?.(user);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Mobile-friendly card view (alternative for very small screens) */}
      <div className="sm:hidden space-y-3 mt-4">
        <h3 className="text-sm font-medium text-muted-foreground">Card View (Mobile Only)</h3>
        {isLoading ? (
          <div className="text-center py-4">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-4">No users found.</div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors"
              onClick={onUserClick ? () => onUserClick(user) : undefined}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{user.name}</h4>
                <Badge
                  variant="outline"
                  className={`${roleBadgeConfig[user.role].color}`}
                >
                  {roleBadgeConfig[user.role].label}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <div className="text-xs font-mono text-muted-foreground">ID: {user.id}</div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditUser?.(user);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteUser?.(user);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Simple Pagination UI */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          disabled={true} // This would be controlled by pagination state in a real implementation
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={true} // This would be controlled by pagination state in a real implementation
        >
          Next
        </Button>
      </div>
    </div>
  );
} 