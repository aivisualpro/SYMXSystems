
"use client";

import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { formatPhoneNumber } from "@/lib/utils";
import { EmployeeForm } from "@/components/admin/employee-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";

export default function EmployeesPage() {
  const [data, setData] = useState<ISymxEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showTerminated, setShowTerminated] = useState(false);
  const router = useRouter();

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/employees");
      if (response.ok) {
        const employees: ISymxEmployee[] = await response.json();
        // Sort alphabetically by first name
        const sorted = [...employees].sort((a, b) => 
          (a.firstName || "").localeCompare(b.firstName || "")
        );
        setData(sorted);
      } else {
        toast.error("Failed to fetch employees");
      }
    } catch (error) {
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const url = editingItem?._id
        ? `/api/admin/employees/${editingItem._id}`
        : "/api/admin/employees";
      const method = editingItem?._id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save employee");

      toast.success(editingItem?._id ? "Employee updated successfully" : "Employee created successfully");
      setIsDialogOpen(false);
      fetchEmployees();
    } catch (error) {
       toast.error("Failed to save employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Are you sure you want to delete this employee?")) return;
      
      try {
          const response = await fetch(`/api/admin/employees/${id}`, {
              method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete employee");
          toast.success("Employee deleted successfully");
          fetchEmployees();
      } catch (error) {
          toast.error("Failed to delete employee");
      }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: ISymxEmployee) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  // Helper for file link cells
  const FileLinkCell = ({ value }: { value?: string }) => {
    if (!value) return null;
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        View
      </a>
    );
  };

  const columns: ColumnDef<ISymxEmployee>[] = [
    {
       id: "profileImage",
       header: "Image",
       cell: ({ row }) => (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
               {row.original.profileImage ? (
                   <img src={row.original.profileImage} alt="User" className="h-full w-full object-cover" />
               ) : (
                   <User className="h-5 w-5 text-muted-foreground" />
               )}
          </div>
       ),
    },
    { accessorKey: "firstName", header: "First Name" },
    { accessorKey: "lastName", header: "Last Name" },
    { accessorKey: "email", header: "Email" },
    { 
      accessorKey: "phoneNumber", 
      header: "Phone",
      cell: ({ row }) => formatPhoneNumber(row.original.phoneNumber || "")
    },
    { accessorKey: "type", header: "Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            row.original.status === 'Active' ? 'bg-green-100 text-green-800' : 
            row.original.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
        }`}>
            {row.original.status}
        </span>
      )
    },
    // Hidden columns by default
    { accessorKey: "eeCode", header: "EE Code" },
    { accessorKey: "transporterId", header: "Transporter ID" },
    { accessorKey: "badgeNumber", header: "Badge #" },
    { accessorKey: "streetAddress", header: "Address" },
    { accessorKey: "city", header: "City" },
    { accessorKey: "state", header: "State" },
    { accessorKey: "zipCode", header: "Zip" },
    { accessorKey: "gender", header: "Gender" },
    { accessorKey: "hiredDate", header: "Hired Date", cell: ({row}) => row.original.hiredDate ? new Date(row.original.hiredDate).toLocaleDateString() : "" },
    { accessorKey: "dob", header: "DOB", cell: ({row}) => row.original.dob ? new Date(row.original.dob).toLocaleDateString() : "" },
    { accessorKey: "hourlyStatus", header: "Hourly Status" },
    { accessorKey: "rate", header: "Rate" },
    { accessorKey: "gasCardPin", header: "Gas Card PIN" },
    { accessorKey: "dlExpiration", header: "DL Exp", cell: ({row}) => row.original.dlExpiration ? new Date(row.original.dlExpiration).toLocaleDateString() : "" },
    { accessorKey: "motorVehicleReportDate", header: "MVR Date", cell: ({row}) => row.original.motorVehicleReportDate ? new Date(row.original.motorVehicleReportDate).toLocaleDateString() : "" },
    { accessorKey: "defaultVan1", header: "Van 1" },
    { accessorKey: "defaultVan2", header: "Van 2" },
    { accessorKey: "defaultVan3", header: "Van 3" },
    { accessorKey: "routesComp", header: "Routes Comp" },
    { accessorKey: "ScheduleNotes", header: "Schedule Notes" },
    
    // Availability
    { accessorKey: "sunday", header: "Sun", cell: ({row}) => row.original.sunday || "OFF" },
    { accessorKey: "monday", header: "Mon", cell: ({row}) => row.original.monday || "OFF" },
    { accessorKey: "tuesday", header: "Tue", cell: ({row}) => row.original.tuesday || "OFF" },
    { accessorKey: "wednesday", header: "Wed", cell: ({row}) => row.original.wednesday || "OFF" },
    { accessorKey: "thursday", header: "Thu", cell: ({row}) => row.original.thursday || "OFF" },
    { accessorKey: "friday", header: "Fri", cell: ({row}) => row.original.friday || "OFF" },
    { accessorKey: "saturday", header: "Sat", cell: ({row}) => row.original.saturday || "OFF" },

    // Files
    { accessorKey: "offerLetterFile", header: "Offer Letter", cell: ({row}) => <FileLinkCell value={row.original.offerLetterFile} /> },
    { accessorKey: "handbookFile", header: "Handbook", cell: ({row}) => <FileLinkCell value={row.original.handbookFile} /> },
    { accessorKey: "driversLicenseFile", header: "DL File", cell: ({row}) => <FileLinkCell value={row.original.driversLicenseFile} /> },
    { accessorKey: "i9File", header: "I-9", cell: ({row}) => <FileLinkCell value={row.original.i9File} /> },
    { accessorKey: "drugTestFile", header: "Drug Test", cell: ({row}) => <FileLinkCell value={row.original.drugTestFile} /> },

    // Offboarding
    { accessorKey: "paycomOffboarded", header: "Paycom Off", cell: ({row}) => row.original.paycomOffboarded ? "Yes" : "No" },
    { accessorKey: "amazonOffboarded", header: "Amazon Off", cell: ({row}) => row.original.amazonOffboarded ? "Yes" : "No" },
    { accessorKey: "finalCheckIssued", header: "Final Check Issued", cell: ({row}) => row.original.finalCheckIssued ? "Yes" : "No" },
    { accessorKey: "finalCheck", header: "Final Check Cleared", cell: ({row}) => <FileLinkCell value={row.original.finalCheck} /> },
    { accessorKey: "terminationDate", header: "Term Date", cell: ({row}) => row.original.terminationDate ? new Date(row.original.terminationDate).toLocaleDateString() : "" },
    { accessorKey: "terminationReason", header: "Term Reason" },
    { accessorKey: "terminationLetter", header: "Term Letter", cell: ({row}) => <FileLinkCell value={row.original.terminationLetter} /> },
    { accessorKey: "resignationDate", header: "Resign Date", cell: ({row}) => row.original.resignationDate ? new Date(row.original.resignationDate).toLocaleDateString() : "" },
    { accessorKey: "resignationType", header: "Resign Type" },
    { accessorKey: "resignationLetter", header: "Resign Letter", cell: ({row}) => <FileLinkCell value={row.original.resignationLetter} /> },
    { accessorKey: "eligibility", header: "Eligibility", cell: ({row}) => row.original.eligibility ? "Yes" : "No" },
    { accessorKey: "lastDateWorked", header: "Last Worked", cell: ({row}) => row.original.lastDateWorked ? new Date(row.original.lastDateWorked).toLocaleDateString() : "" },
    { accessorKey: "exitInterviewNotes", header: "Exit Notes" },
    

  ];

  // Define initial visibility: Show key fields, hide others
  const initialVisibility = {
    eeCode: false,
    transporterId: false,
    badgeNumber: false,
    streetAddress: false,
    city: false,
    state: false,
    zipCode: false,
    gender: false,
    hiredDate: false,
    dob: false,
    hourlyStatus: false,
    rate: false,
    gasCardPin: false,
    dlExpiration: false,
    motorVehicleReportDate: false,
    defaultVan1: false,
    defaultVan2: false,
    defaultVan3: false,
    routesComp: false,
    ScheduleNotes: false,
    sunday: false,
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    offerLetterFile: false,
    handbookFile: false,
    driversLicenseFile: false,
    i9File: false,
    drugTestFile: false,
    paycomOffboarded: false,
    amazonOffboarded: false,
    finalCheckIssued: false,
    finalCheck: false,
    terminationDate: false,
    terminationReason: false,
    terminationLetter: false,
    resignationDate: false,
    resignationType: false,
    resignationLetter: false,
    eligibility: false,
    lastDateWorked: false,
    exitInterviewNotes: false,
  };

  const filteredData = React.useMemo(() => {
    if (showTerminated) return data;
    return data.filter(emp => emp.status !== 'Terminated');
  }, [data, showTerminated]);

  return (
    <div className="w-full h-full">
      <SimpleDataTable 
         data={filteredData} 
         columns={columns} 
         title="Employees" 
         onAdd={openAddDialog} 
         loading={loading}
         showColumnToggle={true}
         initialColumnVisibility={initialVisibility}
         enableGlobalFilter={true}
         onRowClick={(employee) => router.push(`/hr/${employee._id}`)}
         extraActions={
           <div className="flex items-center space-x-2 mr-2">
             <Switch 
               id="show-terminated" 
               checked={showTerminated} 
               onCheckedChange={setShowTerminated}
             />
             <Label htmlFor="show-terminated" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
               Include Terminated
             </Label>
           </div>
         }
      />
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <EmployeeForm 
            initialData={editingItem ? { ...editingItem, _id: String(editingItem._id) } : {}} 
            onSubmit={handleSubmit} 
            isLoading={isSubmitting} 
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
