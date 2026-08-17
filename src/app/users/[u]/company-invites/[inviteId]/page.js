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
  pending: { label: 'Awaiting Review', color: 'bg-yellow-100 text-yellow-800' },
  info_requested: { label: 'More Info Requested', color: 'bg-purple-100 text-purple-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  onboarded: { label: 'Approved', color: 'bg-green-100 text-green-800' },
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

      const { data: companyData, error: companyError } = await supabase
        .from('companies_lite')
        .select('company_id, name, logo')
        .eq('company_id', inviteData.company_id)
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
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setError(null);

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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-900 mb-2">Error</h1>
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => router.push(`/users/${userHandle}/company-invites`)}
            className="mt-4"
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
      <div className="container mx-auto py-10 px-4 max-w-lg">
        <Card className="p-6 text-center space-y-4">
          {company?.logo && (
            <img
              src={company.logo}
              alt={company.name}
              className="h-12 w-12 rounded-full mx-auto object-cover border"
            />
          )}
          <h1 className="text-xl font-bold">{company?.name}</h1>
          {config && <Badge className={config.color}>{config.label}</Badge>}

          {pendingRecord?.status === 'rejected' && pendingRecord?.rejected_reason && (
            <p className="text-sm text-gray-600">{pendingRecord.rejected_reason}</p>
          )}
          {pendingRecord?.status === 'pending' && (
            <p className="text-sm text-gray-600">
              Your submission has been received and is awaiting review.
            </p>
          )}
          {pendingRecord?.status === 'onboarded' && (
            <p className="text-sm text-gray-600">You've been onboarded to this company.</p>
          )}
          {pendingRecord?.reviewed_at && (
            <p className="text-xs text-gray-400">
              Last reviewed {new Date(pendingRecord.reviewed_at).toLocaleDateString()}
            </p>
          )}

          <Button
            variant="outline"
            onClick={() => router.push(`/users/${params.u}/company-invites`)}
          >
            Back to Invites
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl">
      <div className="mb-10 text-center">
        {company?.logo && (
          <img
            src={company.logo}
            alt={company.name}
            className="h-12 w-12 rounded-full mx-auto mb-3 object-cover border"
          />
        )}
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {mode === 'edit' ? 'Update Your Submission' : 'Accept Invitation'}
        </h1>
        <p className="text-gray-500 text-sm">
          {mode === 'edit'
            ? 'The company requested more information. Update your details below.'
            : 'Complete your details to join the team'}
        </p>
        {company && (
          <Badge variant="secondary" className="mt-3 gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {company.name}
          </Badge>
        )}
      </div>

      {mode === 'edit' && pendingRecord?.info_request_details && (
        <Card className="border-purple-200 bg-purple-50 p-4 mb-6">
          <p className="text-sm text-purple-800">
            <span className="font-semibold">Note from {company?.name}: </span>
            {pendingRecord.info_request_details}
          </p>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 pb-1 border-b">
            <User className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold">Personal Information</h2>
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
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 pb-1 border-b">
            <CreditCard className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold">Identification</h2>
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
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 pb-1 border-b">
            <Landmark className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold">Bank Details</h2>
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
            className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none sm:px-8"
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
            onClick={() => router.push(`/users/${params.u}/company-invites`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}