'use client';

import { useState, useContext, useEffect } from 'react';
import { CompanyInfoContext } from '../../companyInfoProvider'
import { DataContext } from '../../../../pageLayoutProvider'
import { useParams } from 'next/navigation';
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
import { CheckCircle2, XCircle, Clock, FileText, Mail, Eye, HelpCircle, Ban, UserPlus } from 'lucide-react';
import Link from 'next/link';

const statusConfig = {
  pending: { label: 'Pending Review', icon: Clock, color: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-rose-100 text-rose-800' },
};

// Added 'declined' — for invitations the person explicitly declined,
// distinct from 'expired' (invite just timed out unanswered).
const invitationStatusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepted', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Declined', icon: Ban, color: 'bg-gray-100 text-gray-700' },
  expired: { label: 'Expired', icon: XCircle, color: 'bg-rose-100 text-rose-800' },
};

const onboardingStatusConfig = {
  pending: { label: 'Awaiting Review', color: 'bg-amber-100 text-amber-800' },
  onboarded: { label: 'Onboarded', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-800' },
  info_requested: { label: 'More Info Requested', color: 'bg-core_light text-core' },
};

// TODO: confirm the actual storage bucket name used for staff documents
const STAFF_DOCS_BUCKET = 'staff-documents';

// ─────────────────────────────────────────────────────────────
// Stat strip — hairline-divided, matches the pattern used across
// the company/branch/staff dashboards instead of 3 separate cards.
// Column count is dynamic (3 for Applications, 4 for Invitations)
// but must stay literal Tailwind classes for JIT to pick them up.
// ─────────────────────────────────────────────────────────────
const STAT_STRIP_COLUMN_CLASSES = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

function StatStrip({ items }) {
  const gridClass = STAT_STRIP_COLUMN_CLASSES[items.length] || 'grid-cols-3';

  return (
    <div className={`bg-card border border-border rounded-xl grid ${gridClass} divide-x divide-border`}>
      {items.map((item, i) => (
        <div key={i} className="px-5 py-4">
          <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
          {item.loading ? (
            <div className="h-6 w-10 bg-muted rounded animate-pulse mt-1.5" />
          ) : (
            <p className={`text-xl font-mono font-semibold mt-1 ${item.colorClass}`}>{item.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { u, companyId: routeCompanyId } = useParams();
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

  // Fetch branches for the company to populate the Branch select.
  // Fixed: was querying `branches_lite`, which no longer exists —
  // this silently returned an empty list, leaving the Branch select
  // in the review panel permanently empty.
  useEffect(() => {
    const fetchBranches = async () => {
      if (!companyId) {
        setIsLoadingBranches(false);
        return;
      }

      try {
        setIsLoadingBranches(true);

        const { data, error } = await supabase
          .from('branches')
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

  // Normalizes raw DB status values into the four buckets the UI understands:
  // pending, accepted, declined, expired. Anything else (e.g. a literal
  // 'declined' value already written by a decline flow) passes through as-is.
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
    try {
      setIsProcessingStaffAction(true);

      const { error } = await supabase.rpc('accept_staff_onboarding', {
        p_pending_id: pendingId,
        p_branch_id: selectedBranchId || null,
        p_access_level: selectedAccessLevel || null,
        p_role_id: selectedRoleId === 'none' ? null : selectedRoleId,
      });

      if (error) throw error;

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
      window.location.reload();
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
      window.location.reload();
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
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2 className="text-base font-semibold text-foreground">Staff Onboarding</h2>
        <Link href={`/users/${u}/company/${routeCompanyId}/staff/new`} className="shrink-0">
          <Button className="flex items-center bg-core hover:bg-core/90 text-white gap-1.5 text-sm font-medium">
            <UserPlus className="size-4" />
            Invite staff
          </Button>
        </Link>
      </div>
      <Tabs defaultValue="invitations" className="w-full flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>
        <div className="flex flex-col gap-4 overflow-y-hidden grow ">
        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-3 flex flex-col overflow-y-hidden">
          <StatStrip
            items={[
              { label: 'Pending Review', value: applications.filter(a => a.status === 'pending').length, colorClass: 'text-amber-600' },
              { label: 'Approved', value: applications.filter(a => a.status === 'approved').length, colorClass: 'text-emerald-600' },
              { label: 'Rejected', value: applications.filter(a => a.status === 'rejected').length, colorClass: 'text-rose-600' },
            ]}
          />

          <Card className="rounded-xl border-border gap-3 overflow-y-hidden grow p-3">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-foreground">Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 grow overflow-y-hidden my-0 p-0">
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected'].map(status => (
                  <Button
                    key={status}
                    variant={appFilterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAppFilterStatus(status)}
                    className={appFilterStatus === status ? 'bg-core hover:bg-core/90 text-white' : 'border-border text-foreground hover:bg-muted'}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>

              <Input
                placeholder="Search by name or email..."
                value={appSearchTerm}
                onChange={(e) => setAppSearchTerm(e.target.value)}
                className="max-w-sm"
              />

              {filteredApplications.length === 0 ? (
                <Alert className="border-border">
                  <AlertDescription className="text-muted-foreground">No applications found</AlertDescription>
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
                            <TableCell className="font-medium text-foreground">
                              {application.data?.firstName} {application.data?.lastName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{application.email}</TableCell>
                            <TableCell className="text-muted-foreground">{application.data?.phone || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">
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
                                className="border-border text-foreground hover:bg-muted"
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
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">First Name</p>
                        <p className="font-medium text-foreground">{selectedApp.data?.firstName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Name</p>
                        <p className="font-medium text-foreground">{selectedApp.data?.lastName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium text-foreground">{selectedApp.email}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium text-foreground">{selectedApp.data?.phone || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Address</h3>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>{selectedApp.data?.address}</p>
                      <p>
                        {selectedApp.data?.city}, {selectedApp.data?.state} {selectedApp.data?.zipCode}
                      </p>
                    </div>
                  </div>

                  {selectedApp.status === 'pending' && (
                    <div>
                      <label className="text-sm font-medium text-foreground">
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
                    <Button variant="outline" className="border-border text-foreground hover:bg-muted">
                      Reject
                    </Button>
                    <Button className="bg-core hover:bg-core/90 text-white">
                      Approve & Create Account
                    </Button>
                  </div>
                )}
                {selectedApp?.status !== 'pending' && (
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted"
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
          <StatStrip
            items={[
              { label: 'Pending', value: normalizedInvitations.filter(i => i.normalizedStatus === 'pending').length, colorClass: 'text-amber-600', loading: isLoadingInvitations },
              { label: 'Accepted', value: normalizedInvitations.filter(i => i.normalizedStatus === 'accepted').length, colorClass: 'text-emerald-600', loading: isLoadingInvitations },
              { label: 'Declined', value: normalizedInvitations.filter(i => i.normalizedStatus === 'declined').length, colorClass: 'text-gray-600', loading: isLoadingInvitations },
              { label: 'Expired', value: normalizedInvitations.filter(i => i.normalizedStatus === 'expired').length, colorClass: 'text-rose-600', loading: isLoadingInvitations },
            ]}
          />

          <Card className="rounded-xl border-border gap-3 overflow-y-hidden grow p-3">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="pt-2 font-semibold text-foreground">Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 grow overflow-y-hidden my-0 p-0">
              {!isReviewingStaff && (
                <>
                  <div className="flex gap-2">
                    {['pending', 'accepted', 'declined', 'expired'].map(status => (
                      <Button
                        key={status}
                        variant={invFilterStatus === status ? 'default' : 'outline'}
                        onClick={() => setInvFilterStatus(status)}
                        className={invFilterStatus === status ? 'bg-core text-xs hover:bg-core/90 text-white' : 'text-xs border-border text-foreground hover:bg-muted'}
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
                  <Button variant="outline" className="text-xs bg-core hover:bg-core/90 text-white h-8 w-fit border-0" onClick={handleBackToStaffList}>
                    ← Go Back
                  </Button>

                  <Card className="border-border flex-col rounded-xl">
                    <CardHeader className="">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-foreground">
                            {selectedStaffRecord.first_name} {selectedStaffRecord.last_name}
                          </CardTitle>
                          <CardDescription>
                            {selectedStaffRecord.company_invites?.email || '-'}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-emerald-100 text-emerald-800">
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
                        <h3 className="font-semibold text-foreground mb-3">Personal Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">First Name</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.first_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Name</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.last_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gender</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.gender || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Date of Birth</p>
                            <p className="font-medium text-foreground">
                              {selectedStaffRecord.date_of_birth
                                ? new Date(selectedStaffRecord.date_of_birth).toLocaleDateString()
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Phone</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.phone || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Email</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.company_invites?.email || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Address</h3>
                        <p className="text-sm text-muted-foreground">{selectedStaffRecord.address || '-'}</p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Identification</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">ID Type</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.identity_type || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">ID Number</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.identity_number || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Bank Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Bank Name</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.bank_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Account Number</p>
                            <p className="font-medium text-foreground">{selectedStaffRecord.bank_account || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-3">Documents</h3>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {selectedStaffRecord.photo && (
                            <Link
                              href={getPublicFileUrl(selectedStaffRecord.photo)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-core underline flex items-center gap-1"
                            >
                              <FileText className="size-4" /> Photo
                            </Link>
                          )}
                          {selectedStaffRecord.signature_file && (
                            <Link
                              href={getPublicFileUrl(selectedStaffRecord.signature_file)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-core underline flex items-center gap-1"
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
                                  className="text-core underline flex items-center gap-1"
                                >
                                  <FileText className="size-4" /> {label}
                                </Link>
                              );
                            })}
                          {!selectedStaffRecord.photo &&
                            !selectedStaffRecord.signature_file &&
                            (!selectedStaffRecord.additional_documents || selectedStaffRecord.additional_documents.length === 0) && (
                              <p className="text-muted-foreground">No documents uploaded</p>
                            )}
                        </div>
                      </div>

                      {selectedStaffRecord.status !== 'onboarded' && (
                        <div>
                          <label className="text-sm font-medium text-foreground">
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

                      <div className="mt-3">
                        <h3 className="font-semibold text-foreground mb-2">Configuration</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm items-center">
                          <div>
                            <p className="text-muted-foreground">Branch</p>
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
                            <p className="text-muted-foreground">Access Level</p>
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
                            <p className="text-muted-foreground">Role</p>
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
                          className="border-border text-foreground hover:bg-muted"
                          disabled={isProcessingStaffAction}
                          onClick={() => handleRequestMoreInfo(selectedStaffRecord?.id)}
                        >
                          Request More Info
                        </Button>
                        <Button
                          variant="destructive"
                          className="bg-rose-600 hover:bg-rose-700 text-white"
                          disabled={isProcessingStaffAction}
                          onClick={() => handleRejectStaff(selectedStaffRecord?.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          className="bg-core hover:bg-core/90 text-white"
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
                  <Alert className="border-border">
                    <AlertDescription className="text-muted-foreground">Loading onboarding records...</AlertDescription>
                  </Alert>
                ) : staffPendingError ? (
                  <Alert className="border-rose-200 bg-rose-50">
                    <AlertDescription className="text-rose-700">{staffPendingError}</AlertDescription>
                  </Alert>
                ) : filteredStaffPending.length === 0 ? (
                  <Alert className="border-border">
                    <AlertDescription className="text-muted-foreground">No accepted invitations found</AlertDescription>
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
                              <TableCell className="font-medium text-foreground">
                                {record.first_name} {record.last_name}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Mail className="size-4" />
                                  {record.company_invites?.email || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {record.company_invites?.created_at
                                  ? new Date(record.company_invites.created_at).toLocaleDateString()
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  <Badge className="bg-emerald-100 text-emerald-800">
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
                                  className="border-border text-foreground hover:bg-muted"
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
                isLoadingInvitations ? (
                  <Alert className="border-border">
                    <AlertDescription className="text-muted-foreground">Loading invitations...</AlertDescription>
                  </Alert>
                ) : invitationError ? (
                  <Alert className="border-rose-200 bg-rose-50">
                    <AlertDescription className="text-rose-700">{invitationError}</AlertDescription>
                  </Alert>
                ) : filteredInvitations.length === 0 ? (
                  <Alert className="border-border">
                    <AlertDescription className="text-muted-foreground">No invitations found</AlertDescription>
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
                          const StatusIcon = config?.icon || HelpCircle;

                          return (
                            <TableRow key={invitation.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2 text-foreground">
                                  <Mail className="size-4 text-muted-foreground" />
                                  {invitation.email}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {invitation.created_at ? new Date(invitation.created_at).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className={config?.color || 'bg-muted text-muted-foreground'}>
                                  <StatusIcon className="size-3 mr-1" />
                                  {config?.label || invitation.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {invitation.expiry ? new Date(invitation.expiry).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-border text-foreground hover:bg-muted"
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

          {/* Legacy dialog — currently unused since openStaffReview routes to the
              inline review panel above; left in place and kept in sync in case
              it's re-enabled. */}
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
                    <h3 className="font-semibold text-foreground mb-3">Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">First Name</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.first_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Name</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.last_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gender</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.gender || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date of Birth</p>
                        <p className="font-medium text-foreground">
                          {selectedStaffRecord.date_of_birth
                            ? new Date(selectedStaffRecord.date_of_birth).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.company_invites?.email || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Address</h3>
                    <p className="text-sm text-muted-foreground">{selectedStaffRecord.address || '-'}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Identification</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">ID Type</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.identity_type || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ID Number</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.identity_number || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Bank Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Bank Name</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.bank_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Account Number</p>
                        <p className="font-medium text-foreground">{selectedStaffRecord.bank_account || '-'}</p>
                      </div>
                    </div>
                  </div>

                <div>
                    <h3 className="font-semibold text-foreground mb-3">Documents</h3>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {selectedStaffRecord.photo && (
                        <Link
                          href={getPublicFileUrl(selectedStaffRecord.photo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-core underline flex items-center gap-1"
                        >
                          <FileText className="size-4" /> Photo
                        </Link>
                      )}
                      {selectedStaffRecord.signature_file && (
                        <Link
                          href={getPublicFileUrl(selectedStaffRecord.signature_file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-core underline flex items-center gap-1"
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
                              className="text-core underline flex items-center gap-1"
                            >
                              <FileText className="size-4" /> {label}
                            </Link>
                          );
                        })}
                      {!selectedStaffRecord.photo &&
                        !selectedStaffRecord.signature_file &&
                        (!selectedStaffRecord.additional_documents ||
                          selectedStaffRecord.additional_documents.length === 0) && (
                          <p className="text-muted-foreground">No documents uploaded</p>
                        )}
                    </div>
                  </div>

                  {selectedStaffRecord.status !== 'onboarded' && (
                    <div>
                      <label className="text-sm font-medium text-foreground">
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
                      className="border-border text-foreground hover:bg-muted"
                      disabled={isProcessingStaffAction}
                      onClick={() => handleRequestMoreInfo(selectedStaffRecord?.id)}
                    >
                      Request More Info
                    </Button>
                    <Button
                      variant="destructive"
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                      disabled={isProcessingStaffAction}
                      onClick={() => handleRejectStaff(selectedStaffRecord?.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      className="bg-core hover:bg-core/90 text-white"
                      disabled={isProcessingStaffAction}
                      onClick={() => handleAcceptStaff(selectedStaffRecord?.id)}
                    >
                      Accept & Onboard
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="border-border text-foreground hover:bg-muted" onClick={() => setIsStaffReviewOpen(false)}>
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