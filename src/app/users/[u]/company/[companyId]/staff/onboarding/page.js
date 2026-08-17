'use client';

import { useState, useContext, useEffect } from 'react';
import { CompanyInfoContext } from '../../companyInfoProvider'
import { DataContext } from '../../../../pageLayoutProvider'
import supabase from '@/config/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow,} from '@/components/ui/table';
import {  Dialog,  DialogContent,  DialogDescription,  DialogFooter,  DialogHeader,  DialogTitle,} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Clock, FileText, Mail, Eye } from 'lucide-react';
import Link from 'next/link';

const statusConfig = {
  pending: { label: 'Pending Review', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

const invitationStatusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Accepted', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  expired: { label: 'Expired', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

const onboardingStatusConfig = {
  pending: { label: 'Awaiting Review', color: 'bg-orange-100 text-orange-800' },
  onboarded: { label: 'Onboarded', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  info_requested: { label: 'More Info Requested', color: 'bg-purple-100 text-purple-800' },
};

// TODO: confirm the actual storage bucket name used for staff documents
const STAFF_DOCS_BUCKET = 'staff-documents';

export default function OnboardingPage() {
  const { info, user, branches: contextBranches, accessLevels: contextAccessLevels } = useContext(CompanyInfoContext);
  const { data: dataContext } = useContext(DataContext);

  // Applications State
  const [applications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [appFilterStatus, setAppFilterStatus] = useState('pending');
  const [appSearchTerm, setAppSearchTerm] = useState('');

  // Invitations State
  const [invitations, setInvitations] = useState([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [invitationError, setInvitationError] = useState('');
  const [invSearchTerm, setInvSearchTerm] = useState('');
  const [invFilterStatus, setInvFilterStatus] = useState('pending');

  // Staff onboarding (accepted invites) state
  const [staffPendingList, setStaffPendingList] = useState([]);
  const [isLoadingStaffPending, setIsLoadingStaffPending] = useState(true);
  const [staffPendingError, setStaffPendingError] = useState('');
  const [selectedStaffRecord, setSelectedStaffRecord] = useState(null);
  const [isStaffReviewOpen, setIsStaffReviewOpen] = useState(false);
  const [isReviewingStaff, setIsReviewingStaff] = useState(false);
  const [staffActionReason, setStaffActionReason] = useState('');
  // Configuration selections for onboarding
  const [branchesList, setBranchesList] = useState([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState('basic');
  const [rolesList, setRolesList] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('none');
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isProcessingStaffAction, setIsProcessingStaffAction] = useState(false);

  const companyId = info?.id || info?.company_id || info?.companyId;
  // The currently logged-in user performing the review (used for reviewed_by)
  const reviewerId = dataContext?.profile?.id || dataContext?.profile?.user_id || dataContext?.profile?.uid || null;

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!companyId) {
        setIsLoadingInvitations(false);
        return;
      }

      try {
        setIsLoadingInvitations(true);
        setInvitationError('');

        const { data, error } = await supabase
          .from('company_invites')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setInvitations((data || []).map((invite) => ({
          ...invite,
          status: invite.status || 'pending',
        })));
      } catch (err) {
        console.error('Error fetching company invitations:', err);
        setInvitationError(err.message || 'Failed to load invitations.');
        setInvitations([]);
      } finally {
        setIsLoadingInvitations(false);
      }
    };

    fetchInvitations();
  }, [companyId]);

  useEffect(() => {
    const fetchStaffPending = async () => {
      if (!companyId) {
        setIsLoadingStaffPending(false);
        return;
      }

      try {
        setIsLoadingStaffPending(true);
        setStaffPendingError('');

        const { data, error } = await supabase
          .from('staff_pending_acceptance')
          .select('*, company_invites(email, created_at)')
          .eq('company', companyId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setStaffPendingList(data || []);
        // fetch company roles
        try {
          setIsLoadingRoles(true);
          const { data: rolesData, error: rolesError } = await supabase
            .from('company_roles')
            .select('id, role')
            .eq('company_id', companyId)
            .order('role', { ascending: true });
          if (rolesError) throw rolesError;
          setRolesList(rolesData || []);
        } catch (err) {
          console.error('Error fetching roles:', err);
          setRolesList([]);
        } finally {
          setIsLoadingRoles(false);
        }
      } catch (err) {
        console.error('Error fetching staff pending acceptance:', err);
        setStaffPendingError(err.message || 'Failed to load onboarding records.');
        setStaffPendingList([]);
      } finally {
        setIsLoadingStaffPending(false);
      }
    };

    fetchStaffPending();
  }, [companyId]);

  // Fetch branches for the company to populate the Branch select
  useEffect(() => {
    const fetchBranches = async () => {
      if (!companyId) {
        setIsLoadingBranches(false);
        return;
      }

      try {
        setIsLoadingBranches(true);

        const { data, error } = await supabase
          .from('branches_lite')
          .select('id, name, slug, isheadoffice')
          .eq('company', companyId)
          .order('name', { ascending: true });

        if (error) throw error;

        setBranchesList(data || []);
      } catch (err) {
        console.error('Error fetching branches:', err);
        setBranchesList([]);
      } finally {
        setIsLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [companyId]);

  // Normalize a staff branch value to a branch UUID, falling back to head office or first branch.
  const getDefaultBranchId = (branchValue) => {
    const branch = (branchesList || []).find((b) => String(b.slug) === String(branchValue) || String(b.id) === String(branchValue));
    if (branch) return branch.id;
    const head = (branchesList || []).find((b) => b.isheadoffice) || (branchesList || [])[0];
    return head?.id || '';
  };

  // Sync selected defaults when opening a staff record for review.
  // FIX: keyed off selectedStaffRecord?.id (not the whole object) and `info` removed
  // from deps — `info` was never read here, and if the context provider re-creates
  // that object on every render, this effect was re-firing on every Select change
  // and snapping the selection back to the record's default.

  useEffect(() => {
    if (selectedStaffRecord) {
      setSelectedBranchId(getDefaultBranchId(selectedStaffRecord.branch));
      setSelectedAccessLevel('basic');
      setSelectedRoleId('none');
    } else {
      setSelectedBranchId(getDefaultBranchId(null));
      setSelectedAccessLevel('basic');
      setSelectedRoleId('none');
    }
  }, [selectedStaffRecord?.id]);

  // Applications handlers
  const handleViewDetails = (application) => {
    setSelectedApp(application);
    setIsDetailDialogOpen(true);
  };

  const filteredApplications = applications.filter(app => {
    const matchesStatus = app.status === appFilterStatus;
    const matchesSearch =
      app.data?.firstName?.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
      app.data?.lastName?.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
      app.email?.toLowerCase().includes(appSearchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Invitations filters
  const normalizedInvitations = invitations.map((invite) => {
    const normalizedStatus = invite.status === 'registered' || invite.status === 'pending'
      ? 'pending'
      : invite.status === 'accepted'
        ? 'accepted'
        : invite.status;

    return {
      ...invite,
      normalizedStatus,
    };
  });

  const filteredInvitations = normalizedInvitations.filter((invite) => {
    const matchesStatus = invite.normalizedStatus === invFilterStatus;
    const matchesSearch = invite.email?.toLowerCase().includes(invSearchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredStaffPending = staffPendingList.filter((record) => {
    const email = record.company_invites?.email?.toLowerCase() || '';
    const fullName = `${record.first_name || ''} ${record.last_name || ''}`.toLowerCase();
    return email.includes(invSearchTerm.toLowerCase()) || fullName.includes(invSearchTerm.toLowerCase());
  });

  // Staff onboarding helpers
  const getPublicFileUrl = (path) => {
    if (!path) return '#';
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from(STAFF_DOCS_BUCKET).getPublicUrl(path);
    return data?.publicUrl || '#';
  };

  const openStaffReview = (record) => {
    setSelectedStaffRecord(record);
    setStaffActionReason('');
    setIsStaffReviewOpen(false);
    setIsReviewingStaff(true);
  };

  const handleBackToStaffList = () => {
    setSelectedStaffRecord(null);
    setStaffActionReason('');
    setIsReviewingStaff(false);
  };

  const handleAcceptStaff = async (pendingId) => {
    if (!pendingId) return;
    console.log(
      'Accepting staff onboarding for pendingId:', pendingId, 
      'with branch:', selectedBranchId, 
      'access level:', selectedAccessLevel, 
      'role:', selectedRoleId
    );
    try {
      setIsProcessingStaffAction(true);

      // Creates the staff record (insert into `staff`) via the RPC.
      // The `staff` insert fires accept_company_invite_after_staff_insert,
      // staff_lite_after_insert, etc. automatically.
      const { error } = await supabase.rpc('accept_staff_onboarding', {
        p_pending_id: pendingId,
        p_branch_id: selectedBranchId || null,
        p_access_level: selectedAccessLevel || null,
        p_role_id: selectedRoleId === 'none' ? null : selectedRoleId,
      });

      if (error) throw error;

      // Record the reviewer's note against review_notes (acceptance notes),
      // along with who reviewed it and when.
      const { error: reviewUpdateError } = await supabase
        .from('staff_pending_acceptance')
        .update({
          review_notes: staffActionReason || null,
          reviewed_by: reviewerId || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingId);

      if (reviewUpdateError) throw reviewUpdateError;

      setStaffPendingList((prev) =>
        prev.map((rec) => (rec.id === pendingId ? { ...rec, status: 'onboarded' } : rec))
      );
      setStaffActionReason('');
      setIsStaffReviewOpen(false);
      setIsReviewingStaff(false);
      setSelectedStaffRecord(null);
    } catch (err) {
      console.error('Error accepting staff onboarding:', err);
      setStaffPendingError(err.message || 'Failed to onboard staff member.');
    } finally {
      setIsProcessingStaffAction(false);
      window.location.reload(); // Refresh the page to reflect the new staff member in the list
    }
  };

  const handleRejectStaff = async (pendingId) => {
    if (!pendingId) return;
    try {
      setIsProcessingStaffAction(true);
      const { error } = await supabase
        .from('staff_pending_acceptance')
        .update({
          status: 'rejected',
          rejected_reason: staffActionReason || null,
          reviewed_by: reviewerId || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingId);
      if (error) throw error;

      setStaffPendingList((prev) =>
        prev.map((rec) => (rec.id === pendingId ? { ...rec, status: 'rejected' } : rec))
      );
      setStaffActionReason('');
      setIsStaffReviewOpen(false);
      setIsReviewingStaff(false);
      setSelectedStaffRecord(null);
    } catch (err) {
      console.error('Error rejecting staff onboarding:', err);
      setStaffPendingError(err.message || 'Failed to reject application.');
    } finally {
      setIsProcessingStaffAction(false);
      window.location.reload(); // Refresh the page to reflect the updated staff member status
    }
  };

  const handleRequestMoreInfo = async (pendingId) => {
    if (!pendingId) return;
    try {
      setIsProcessingStaffAction(true);
      const { error } = await supabase
        .from('staff_pending_acceptance')
        .update({
          status: 'info_requested',
          info_request_details: staffActionReason || null,
          reviewed_by: reviewerId || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pendingId);
      if (error) throw error;

      setStaffPendingList((prev) =>
        prev.map((rec) => (rec.id === pendingId ? { ...rec, status: 'info_requested' } : rec))
      );
      setStaffActionReason('');
      setIsStaffReviewOpen(false);
      setIsReviewingStaff(false);
      setSelectedStaffRecord(null);
    } catch (err) {
      console.error('Error requesting more info:', err);
      setStaffPendingError(err.message || 'Failed to request more info.');
    } finally {
      setIsProcessingStaffAction(false);
    }
  };

  return (
    <div className="space-y-4 grow flex flex-col text-xs overflow-y-hidden">
      <Tabs defaultValue="invitations" className="w-full flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>
        <div className="flex flex-col gap-4 overflow-y-hidden grow ">
        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-3 flex flex-col overflow-y-hidden">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className=" text-slate-600">Pending Review</p>
                  <p className="text-xl font-bold text-yellow-600">
                    {applications.filter(a => a.status === 'pending').length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Approved</p>
                  <p className="text-3xl font-bold text-green-600">
                    {applications.filter(a => a.status === 'approved').length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Rejected</p>
                  <p className="text-3xl font-bold text-red-600">
                    {applications.filter(a => a.status === 'rejected').length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter and Search */}
           <Card className="rounded-md gap-3 overflow-y-hidden grow p-3">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 grow overflow-y-hidden my-0 p-0">    
              {/* Status Filter */}
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected'].map(status => (
                  <Button
                    key={status}
                    variant={appFilterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAppFilterStatus(status)}
                    className={appFilterStatus === status ? 'bg-core hover:bg-core/90' : ''}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Search */}
              <Input
                placeholder="Search by name or email..."
                value={appSearchTerm}
                onChange={(e) => setAppSearchTerm(e.target.value)}
                className="max-w-sm"
              />

              {/* Applications Table */}
              {filteredApplications.length === 0 ? (
                <Alert>
                  <AlertDescription>No applications found</AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApplications.map((application) => {
                        const config = statusConfig[application.status];
                        const StatusIcon = config.icon;

                        return (
                          <TableRow key={application.id}>
                            <TableCell className="font-medium">
                              {application.data?.firstName} {application.data?.lastName}
                            </TableCell>
                            <TableCell>{application.email}</TableCell>
                            <TableCell>{application.data?.phone || '-'}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(application.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={config.color}>
                                <StatusIcon className="size-3 mr-1" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(application)}
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail Dialog */}
          <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Application Details</DialogTitle>
                <DialogDescription>
                  {selectedApp?.data?.firstName} {selectedApp?.data?.lastName}
                </DialogDescription>
              </DialogHeader>

              {selectedApp && (
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  {/* Personal Info */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">First Name</p>
                        <p className="font-medium">{selectedApp.data?.firstName}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Last Name</p>
                        <p className="font-medium">{selectedApp.data?.lastName}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Email</p>
                        <p className="font-medium">{selectedApp.email}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Phone</p>
                        <p className="font-medium">{selectedApp.data?.phone || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Address</h3>
                    <div className="text-sm space-y-1">
                      <p>{selectedApp.data?.address}</p>
                      <p>
                        {selectedApp.data?.city}, {selectedApp.data?.state} {selectedApp.data?.zipCode}
                      </p>
                    </div>
                  </div>

                  {/* Rejection Reason Input (for pending) */}
                  {selectedApp.status === 'pending' && (
                    <div>
                      <label className="text-sm font-medium text-slate-900">
                        Rejection Reason (if applicable)
                      </label>
                      <Input
                        placeholder="Enter reason for rejection..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                {selectedApp?.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button variant="outline">
                      Reject
                    </Button>
                    <Button className="bg-core hover:bg-core/90">
                      Approve & Create Account
                    </Button>
                  </div>
                )}
                {selectedApp?.status !== 'pending' && (
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailDialogOpen(false)}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-3 flex flex-col overflow-y-hidden">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="h-fit p-3 rounded-md">
              <CardContent className="">
                <div className="flex items-center gap-4">
                  <p className=" text-slate-600">Pending</p>
                  {isLoadingInvitations ? (
                    <div className="h-6 w-8 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xl font-bold text-yellow-600">
                      {normalizedInvitations.filter(i => i.normalizedStatus === 'pending').length}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="h-fit p-3 rounded-md">
              <CardContent className="">
                <div className="flex items-center gap-4">
                  <p className=" text-slate-600">Accepted</p>
                  {isLoadingInvitations ? (
                    <div className="h-6 w-8 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xl font-bold text-green-600">
                      {normalizedInvitations.filter(i => i.normalizedStatus === 'accepted').length}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="h-fit p-3 rounded-md">
              <CardContent className="">
                <div className="flex items-center gap-4">
                  <p className=" text-slate-600">Expired</p>
                  {isLoadingInvitations ? (
                    <div className="h-6 w-8 bg-slate-200 rounded animate-pulse" />
                  ) : (
                    <p className="text-xl font-bold text-red-600">
                      {normalizedInvitations.filter(i => i.normalizedStatus === 'expired').length}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter and Search */}
          <Card className="rounded-md gap-3 overflow-y-hidden grow p-3">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="pt-2 font-semibold">Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 grow overflow-y-hidden my-0 p-0">       
              {/* Search — hidden while a record is being reviewed */}
              {!isReviewingStaff && (
                <>
                  <div className="flex gap-2">
                    {['pending', 'accepted', 'expired'].map(status => (
                      <Button
                        key={status}
                        variant={invFilterStatus === status ? 'default' : 'outline'}
                        onClick={() => setInvFilterStatus(status)}
                        className={invFilterStatus === status ? 'bg-core text-xs hover:bg-core/90' : 'text-xs'}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Button>
                    ))}
                  </div>
                  <Input
                    placeholder="Search by name or email..."
                    value={invSearchTerm}
                    onChange={(e) => setInvSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </>
              )}

              {isReviewingStaff && selectedStaffRecord ? (
                <div className="space-y-2 h-full overflow-y-auto flex flex-col ">
                  <Button variant="outline" className="text-xs bg-black text-white h-8 w-fit" onClick={handleBackToStaffList}>
                    ← Go Back
                  </Button>

                  <Card className="border-slate-200 flex-col rounded-md">
                    <CardHeader className="">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle>
                            {selectedStaffRecord.first_name} {selectedStaffRecord.last_name}
                          </CardTitle>
                          <CardDescription>
                            {selectedStaffRecord.company_invites?.email || '-'}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="size-3 mr-1" />
                            Accepted
                          </Badge>
                          <Badge className={onboardingStatusConfig[selectedStaffRecord.status]?.color || onboardingStatusConfig.pending.color}>
                            {onboardingStatusConfig[selectedStaffRecord.status]?.label || onboardingStatusConfig.pending.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 ">
                      <div>
                        <h3 className="font-semibold text-slate-900 underline italic mb-3">Personal Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">First Name</p>
                            <p className="font-medium">{selectedStaffRecord.first_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Last Name</p>
                            <p className="font-medium">{selectedStaffRecord.last_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Gender</p>
                            <p className="font-medium">{selectedStaffRecord.gender || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Date of Birth</p>
                            <p className="font-medium">
                              {selectedStaffRecord.date_of_birth
                                ? new Date(selectedStaffRecord.date_of_birth).toLocaleDateString()
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-600">Phone</p>
                            <p className="font-medium">{selectedStaffRecord.phone || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Email</p>
                            <p className="font-medium">{selectedStaffRecord.company_invites?.email || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3">Address</h3>
                        <p className="text-sm">{selectedStaffRecord.address || '-'}</p>
                      </div>

                      <div>
                        <h3 className="font-semibold italic underline text-slate-900 mb-3">Identification</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">ID Type</p>
                            <p className="font-medium">{selectedStaffRecord.identity_type || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">ID Number</p>
                            <p className="font-medium">{selectedStaffRecord.identity_number || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-900 underline italic mb-3">Bank Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">Bank Name</p>
                            <p className="font-medium">{selectedStaffRecord.bank_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Account Number</p>
                            <p className="font-medium">{selectedStaffRecord.bank_account || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3">Documents</h3>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {selectedStaffRecord.photo && (
                            <Link
                              href={getPublicFileUrl(selectedStaffRecord.photo)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline flex items-center gap-1"
                            >
                              <FileText className="size-4" /> Photo
                            </Link>
                          )}
                          {selectedStaffRecord.signature_file && (
                            <Link
                              href={getPublicFileUrl(selectedStaffRecord.signature_file)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline flex items-center gap-1"
                            >
                              <FileText className="size-4" /> Signature
                            </Link>
                          )}
                          {Array.isArray(selectedStaffRecord.additional_documents) &&
                            selectedStaffRecord.additional_documents.map((doc, idx) => {
                              const path = typeof doc === 'string' ? doc : doc.path || doc.url;
                              const label = typeof doc === 'string' ? `Document ${idx + 1}` : (doc.name || `Document ${idx + 1}`);
                              return (
                                <Link
                                  key={idx}
                                  href={getPublicFileUrl(path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline flex items-center gap-1"
                                >
                                  <FileText className="size-4" /> {label}
                                </Link>
                              );
                            })}
                          {!selectedStaffRecord.photo &&
                            !selectedStaffRecord.signature_file &&
                            (!selectedStaffRecord.additional_documents || selectedStaffRecord.additional_documents.length === 0) && (
                              <p className="text-slate-500">No documents uploaded</p>
                            )}
                        </div>
                      </div>

                      {selectedStaffRecord.status !== 'onboarded' && (
                        <div>
                          <label className="text-sm font-medium text-slate-900">
                            Notes (for rejection, info request, or acceptance)
                          </label>
                          <Input
                            placeholder="Enter notes..."
                            value={staffActionReason}
                            onChange={(e) => setStaffActionReason(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                      )}

                      {/* Configuration section */}
                      <div className="mt-3">
                        <h3 className="font-semibold text-slate-900 italic underline mb-2">Configuration</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm items-center">
                          <div>
                            <p className="text-slate-600">Branch</p>
                            <Select value={selectedBranchId} onValueChange={(v) => setSelectedBranchId(v)}>
                              <SelectTrigger className="mt-1 w-full">
                                <SelectValue placeholder={isLoadingBranches ? 'Loading...' : 'Select branch'}>{(branchesList || []).find(b => String(b.id) === String(selectedBranchId))?.name}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {(branchesList || []).map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.name}{b.isheadoffice ? ' (Head Office)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <p className="text-slate-600">Access Level</p>
                            <Select value={selectedAccessLevel} onValueChange={(v) => setSelectedAccessLevel(v)}>
                              <SelectTrigger className="mt-1 w-full">
                                <SelectValue placeholder="Select access level">{(info?.accessLevels || contextAccessLevels || []).find(a => a.key === selectedAccessLevel)?.name}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {(info?.accessLevels || contextAccessLevels || []).map((al) => (
                                  <SelectItem key={al.key} value={al.key}>
                                    {al.name || al.key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="col-span-1">
                            <p className="text-slate-600">Role</p>
                            <Select value={selectedRoleId} onValueChange={(v) => setSelectedRoleId(v)}>
                              <SelectTrigger className="mt-1 w-full">
                                <SelectValue placeholder={isLoadingRoles ? 'Loading...' : 'Select role'}>{selectedRoleId === 'none' ? 'None' : (rolesList || []).find(r => String(r.id) === String(selectedRoleId))?.role}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {(rolesList || []).map((r) => (
                                  <SelectItem key={r.id} value={String(r.id)}>
                                    {r.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button
                          variant="outline"
                          disabled={isProcessingStaffAction}
                          onClick={() => handleRequestMoreInfo(selectedStaffRecord?.id)}
                        >
                          Request More Info
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={isProcessingStaffAction}
                          onClick={() => handleRejectStaff(selectedStaffRecord?.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          className="bg-core hover:bg-core/90"
                          disabled={isProcessingStaffAction}
                          onClick={() => handleAcceptStaff(selectedStaffRecord?.id)}
                        >
                          Accept & Onboard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : invFilterStatus === 'accepted' ? (
                isLoadingStaffPending ? (
                  <Alert>
                    <AlertDescription>Loading onboarding records...</AlertDescription>
                  </Alert>
                ) : staffPendingError ? (
                  <Alert>
                    <AlertDescription>{staffPendingError}</AlertDescription>
                  </Alert>
                ) : filteredStaffPending.length === 0 ? (
                  <Alert>
                    <AlertDescription>No accepted invitations found</AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Sent Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Review</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStaffPending.map((record) => {
                          const onboardConfig = onboardingStatusConfig[record.status] || onboardingStatusConfig.pending;

                          return (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.first_name} {record.last_name}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Mail className="size-4 text-gray-400" />
                                  {record.company_invites?.email || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {record.company_invites?.created_at
                                  ? new Date(record.company_invites.created_at).toLocaleDateString()
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Accepted
                                  </Badge>
                                  <Badge className={onboardConfig.color}>
                                    {onboardConfig.label}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={record.status === 'onboarded'}
                                  onClick={() => openStaffReview(record)}
                                >
                                  <Eye className="size-4 mr-1" />
                                  Review
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : (
                /* Pending / Expired: original invitations table */
                isLoadingInvitations ? (
                  <Alert>
                    <AlertDescription>Loading invitations...</AlertDescription>
                  </Alert>
                ) : invitationError ? (
                  <Alert>
                    <AlertDescription>{invitationError}</AlertDescription>
                  </Alert>
                ) : filteredInvitations.length === 0 ? (
                  <Alert>
                    <AlertDescription>No invitations found</AlertDescription>
                  </Alert>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Sent Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvitations.map((invitation) => {
                          const config = invitationStatusConfig[invitation.status];
                          const StatusIcon = config.icon;

                          return (
                            <TableRow key={invitation.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Mail className="size-4 text-gray-400" />
                                  {invitation.email}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {invitation.created_at ? new Date(invitation.created_at).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={config.color}>
                                  <StatusIcon className="size-3 mr-1" />
                                  {config.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {invitation.expiry ? new Date(invitation.expiry).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={invitation.status !== 'pending'}
                                >
                                  Resend
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Staff Onboarding Review Dialog (legacy — currently unused since openStaffReview
              routes to the inline review panel above instead of opening this dialog;
              left in place and kept in sync in case it's re-enabled) */}
          <Dialog open={isStaffReviewOpen} onOpenChange={setIsStaffReviewOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Onboarding Review</DialogTitle>
                <DialogDescription>
                  {selectedStaffRecord?.first_name} {selectedStaffRecord?.last_name}
                  {selectedStaffRecord?.company_invites?.email
                    ? ` — ${selectedStaffRecord.company_invites.email}`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              {selectedStaffRecord && (
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">First Name</p>
                        <p className="font-medium">{selectedStaffRecord.first_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Last Name</p>
                        <p className="font-medium">{selectedStaffRecord.last_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Gender</p>
                        <p className="font-medium">{selectedStaffRecord.gender || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Date of Birth</p>
                        <p className="font-medium">
                          {selectedStaffRecord.date_of_birth
                            ? new Date(selectedStaffRecord.date_of_birth).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Phone</p>
                        <p className="font-medium">{selectedStaffRecord.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Email</p>
                        <p className="font-medium">{selectedStaffRecord.company_invites?.email || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Address</h3>
                    <p className="text-sm">{selectedStaffRecord.address || '-'}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Identification</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">ID Type</p>
                        <p className="font-medium">{selectedStaffRecord.identity_type || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">ID Number</p>
                        <p className="font-medium">{selectedStaffRecord.identity_number || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Bank Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Bank Name</p>
                        <p className="font-medium">{selectedStaffRecord.bank_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Account Number</p>
                        <p className="font-medium">{selectedStaffRecord.bank_account || '-'}</p>
                      </div>
                    </div>
                  </div>

                <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Documents</h3>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {selectedStaffRecord.photo && (
                        <Link
                          href={getPublicFileUrl(selectedStaffRecord.photo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline flex items-center gap-1"
                        >
                          <FileText className="size-4" /> Photo
                        </Link>
                      )}
                      {selectedStaffRecord.signature_file && (
                        <Link
                          href={getPublicFileUrl(selectedStaffRecord.signature_file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline flex items-center gap-1"
                        >
                          <FileText className="size-4" /> Signature
                        </Link>
                      )}
                      {Array.isArray(selectedStaffRecord.additional_documents) &&
                        selectedStaffRecord.additional_documents.map((doc, idx) => {
                          const path = typeof doc === 'string' ? doc : doc.path || doc.url;
                          const label = typeof doc === 'string' ? `Document ${idx + 1}` : (doc.name || `Document ${idx + 1}`);
                          return (
                            <Link
                              key={idx}
                              href={getPublicFileUrl(path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline flex items-center gap-1"
                            >
                              <FileText className="size-4" /> {label}
                            </Link>
                          );
                        })}
                      {!selectedStaffRecord.photo &&
                        !selectedStaffRecord.signature_file &&
                        (!selectedStaffRecord.additional_documents ||
                          selectedStaffRecord.additional_documents.length === 0) && (
                          <p className="text-slate-500">No documents uploaded</p>
                        )}
                    </div>
                  </div>

                  {selectedStaffRecord.status !== 'onboarded' && (
                    <div>
                      <label className="text-sm font-medium text-slate-900">
                        Notes (for rejection, info request, or acceptance)
                      </label>
                      <Input
                        placeholder="Enter notes..."
                        value={staffActionReason}
                        onChange={(e) => setStaffActionReason(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                {selectedStaffRecord?.status !== 'onboarded' ? (
                  <div className="flex gap-2 flex-wrap justify-end w-full">
                    <Button
                      variant="outline"
                      disabled={isProcessingStaffAction}
                      onClick={() => handleRequestMoreInfo(selectedStaffRecord?.id)}
                    >
                      Request More Info
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isProcessingStaffAction}
                      onClick={() => handleRejectStaff(selectedStaffRecord?.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      className="bg-core hover:bg-core/90"
                      disabled={isProcessingStaffAction}
                      onClick={() => handleAcceptStaff(selectedStaffRecord?.id)}
                    >
                      Accept & Onboard
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setIsStaffReviewOpen(false)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}