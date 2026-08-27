'use client';

import { useState, useEffect, useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/config/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, CreditCard, Landmark, Building2 } from 'lucide-react';
import { DataContext } from '../../pageLayoutProvider';

const onboardingStatusConfig = {
  pending: { label: 'Awaiting Review', color: 'bg-amber-100 text-amber-800' },
  info_requested: { label: 'More Info Requested', color: 'bg-core_light text-core' },
  rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-800' },
  onboarded: { label: 'Approved', color: 'bg-emerald-100 text-emerald-800' },
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { data } = useContext(DataContext);
  const userHandle = data?.profile?.handle || params.u;
  const userId = data?.profile?.id;

  const [invite, setInvite] = useState(null);
  const [company, setCompany] = useState(null);
  const [pendingRecord, setPendingRecord] = useState(null);
  // 'new' = first submission, 'edit' = resubmitting after info request, 'readonly' = nothing to do
  const [mode, setMode] = useState('new');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    phone: '',
    address: '',
    identity_type: 'NIN',
    identity_number: '',
    bank_name: '',
    bank_account: '',
    bank_account_name: '',
    photo_file: null,
    signature_file: null,
  });

  useEffect(() => {
    fetchInvite();
  }, []);

  const fetchInvite = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: inviteData, error: inviteError } = await supabase
        .from('company_invites')
        .select('*')
        .eq('id', params.inviteId)
        .maybeSingle();

      if (inviteError) throw inviteError;
      if (!inviteData) throw new Error('Invite not found');

      if (inviteData.status === 'declined' || inviteData.status === 'expired') {
        throw new Error('This invite has already been processed');
      }

      setInvite(inviteData);

      // Fixed: was querying `companies_lite` (retired table, no longer
      // exists) and filtering on `company_id` — the real table is
      // `companies`, keyed on `id`.
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, logo')
        .eq('id', inviteData.company_id)
        .maybeSingle();

      if (companyError) throw companyError;
      setCompany(companyData);

      if (inviteData.status === 'accepted') {
        const { data: record, error: recordError } = await supabase
          .from('staff_pending_acceptance')
          .select('*')
          .eq('company_invite', inviteData.id)
          .maybeSingle();

        if (recordError) throw recordError;

        setPendingRecord(record);

        if (record?.status === 'info_requested') {
          setMode('edit');
          setFormData({
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            gender: record.gender || '',
            date_of_birth: record.date_of_birth || '',
            phone: record.phone || '',
            address: record.address || '',
            identity_type: record.identity_type || 'NIN',
            identity_number: record.identity_number || '',
            bank_name: record.bank_name || '',
            bank_account: record.bank_account || '',
            bank_account_name: record.bank_account_name || '',
            photo_file: null,
            signature_file: null,
          });
        } else {
          setMode('readonly');
        }
      } else {
        setMode('new');
      }
    } catch (err) {
      console.log('Error fetching invite:', err);
      setError(err.message || 'Failed to load invite details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
    }
  };

  const validateForm = () => {
    const required = [
      'first_name',
      'last_name',
      'phone',
      'address',
      'identity_number',
      'bank_name',
      'bank_account',
      'bank_account_name',
    ];

    for (let field of required) {
      if (!formData[field]) {
        setError(`${field.replace(/_/g, ' ')} is required`);
        return false;
      }
    }

    if (!formData.date_of_birth) {
      setError('Date of birth is required');
      return false;
    }

    return true;
  };

  const uploadToBucket = async (file, bucket, userId) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${bucket}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!validateForm()) {
      setSubmitting(false);
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('You must be signed in to submit this form');

      let photoUrl = null;
      let signatureUrl = null;

      if (formData.photo_file) {
        photoUrl = await uploadToBucket(formData.photo_file, 'photos', userId);
      }
      if (formData.signature_file) {
        signatureUrl = await uploadToBucket(formData.signature_file, 'signatures', userId);
      }

      if (mode === 'edit') {
        const { error: rpcError } = await supabase.rpc('update_company_invite_submission', {
          p_pending_id: pendingRecord.id,
          p_first_name: formData.first_name,
          p_last_name: formData.last_name,
          p_gender: formData.gender || null,
          p_date_of_birth: formData.date_of_birth,
          p_phone: formData.phone,
          p_address: formData.address,
          p_identity_type: formData.identity_type,
          p_identity_number: formData.identity_number,
          p_bank_name: formData.bank_name,
          p_bank_account: formData.bank_account,
          p_bank_account_name: formData.bank_account_name,
          p_photo: photoUrl,
          p_signature_file: signatureUrl,
        });

        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc('accept_company_invite_submission', {
          p_invite_id: invite.id,
          p_company_id: invite.company_id,
          p_first_name: formData.first_name,
          p_last_name: formData.last_name,
          p_gender: formData.gender || null,
          p_date_of_birth: formData.date_of_birth,
          p_phone: formData.phone,
          p_address: formData.address,
          p_identity_type: formData.identity_type,
          p_identity_number: formData.identity_number,
          p_bank_name: formData.bank_name,
          p_bank_account: formData.bank_account,
          p_bank_account_name: formData.bank_account_name,
          p_photo: photoUrl,
          p_signature_file: signatureUrl,
        });

        if (rpcError) throw rpcError;
      }

      router.push(`/users/${params.u}/company-invites?success=true`);
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-core" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="border-rose-200 bg-rose-50 p-6 max-w-md w-full">
          <h1 className="text-lg font-semibold text-rose-900 mb-2">Error</h1>
          <p className="text-rose-700 text-sm">{error}</p>
          <Button
            onClick={() => router.push(`/users/${userHandle}/company-invites`)}
            className="mt-4 border-border text-foreground hover:bg-muted"
            variant="outline"
          >
            Back to Invites
          </Button>
        </Card>
      </div>
    );
  }

  // Already submitted and nothing to do — show status instead of the form
  if (mode === 'readonly') {
    const config = pendingRecord ? onboardingStatusConfig[pendingRecord.status] : null;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="border-border p-6 text-center space-y-4 max-w-md w-full">
          {company?.logo ? (
            <img
              src={company.logo}
              alt={company.name}
              className="h-12 w-12 rounded-full mx-auto object-cover border border-border"
            />
          ) : (
            <div className="h-12 w-12 rounded-full mx-auto bg-core_light flex items-center justify-center">
              <span className="text-core font-semibold text-sm">
                {(company?.name || '?').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-xl font-bold text-foreground">{company?.name}</h1>
          {config && <Badge className={config.color}>{config.label}</Badge>}

          {pendingRecord?.status === 'rejected' && pendingRecord?.rejected_reason && (
            <p className="text-sm text-muted-foreground">{pendingRecord.rejected_reason}</p>
          )}
          {pendingRecord?.status === 'pending' && (
            <p className="text-sm text-muted-foreground">
              Your submission has been received and is awaiting review.
            </p>
          )}
          {pendingRecord?.status === 'onboarded' && (
            <p className="text-sm text-muted-foreground">You've been onboarded to this company.</p>
          )}
          {pendingRecord?.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              Last reviewed {new Date(pendingRecord.reviewed_at).toLocaleDateString()}
            </p>
          )}

          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-muted"
            onClick={() => router.push(`/users/${params.u}/company-invites`)}
          >
            Back to Invites
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="container mx-auto max-w-2xl">
        {/* Record header — matches the receipt-tape pattern used elsewhere */}
        <div className="bg-card border border-border rounded-xl px-6 py-5 mb-6">
          <div className="flex items-center gap-4">
            {company?.logo ? (
              <img
                src={company.logo}
                alt={company.name}
                className="size-11 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <div className="size-11 rounded-lg bg-core_light flex items-center justify-center shrink-0">
                <Building2 className="size-5 text-core" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">
                {mode === 'edit' ? 'Update Your Submission' : 'Accept Invitation'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'edit'
                  ? `${company?.name || 'The company'} requested more information — update your details below.`
                  : `Complete your details to join ${company?.name || 'the team'}`}
              </p>
            </div>
          </div>
        </div>

        {mode === 'edit' && pendingRecord?.info_request_details && (
          <Card className="border-core/20 bg-core_light/40 p-4 mb-6">
            <p className="text-sm text-core">
              <span className="font-semibold">Note from {company?.name}: </span>
              <span className="text-foreground">{pendingRecord.info_request_details}</span>
            </p>
          </Card>
        )}

        {error && (
          <Card className="border-rose-200 bg-rose-50 p-4 mb-6">
            <p className="text-sm text-rose-700">{error}</p>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pb-10">
          {/* Personal Info */}
          <Card className="border-border p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="John"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(v) => handleSelectChange('gender', v)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+234 800 000 0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Residential Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Street, city, state"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="photo_file">
                Profile Photo {mode === 'edit' && '(leave blank to keep current photo)'}
              </Label>
              <Input
                id="photo_file"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'photo_file')}
                className="cursor-pointer"
              />
            </div>
          </Card>

          {/* Identification */}
          <Card className="border-border p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Identification</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="identity_type">ID Type</Label>
                <Select
                  value={formData.identity_type}
                  onValueChange={(v) => handleSelectChange('identity_type', v)}
                >
                  <SelectTrigger id="identity_type">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NIN">NIN</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="Drivers License">Drivers License</SelectItem>
                    <SelectItem value="Voters Card">Voters Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="identity_number">ID Number</Label>
                <Input
                  id="identity_number"
                  name="identity_number"
                  value={formData.identity_number}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signature_file">
                Signature {mode === 'edit' && '(leave blank to keep current signature)'}
              </Label>
              <Input
                id="signature_file"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'signature_file')}
                className="cursor-pointer"
              />
            </div>
          </Card>

          {/* Bank Info */}
          <Card className="border-border p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Bank Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="e.g. GTBank"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank_account">Account Number</Label>
                <Input
                  id="bank_account"
                  name="bank_account"
                  value={formData.bank_account}
                  onChange={handleInputChange}
                  placeholder="0123456789"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank_account_name">Account Name</Label>
              <Input
                id="bank_account_name"
                name="bank_account_name"
                value={formData.bank_account_name}
                onChange={handleInputChange}
                placeholder="John Doe"
              />
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-core hover:bg-core/90 text-white flex-1 sm:flex-none sm:px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : mode === 'edit' ? (
                'Resubmit'
              ) : (
                'Accept & Submit'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border text-foreground hover:bg-muted"
              onClick={() => router.push(`/users/${params.u}/company-invites`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}