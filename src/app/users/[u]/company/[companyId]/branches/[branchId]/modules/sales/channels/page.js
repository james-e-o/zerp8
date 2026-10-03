"use client";

import { useState } from "react";
import { ArrowUpRight, Building2, Globe2, Store } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CHANNELS = {
  shopify: {
    name: "Shopify",
    type: "External platform",
  },
  nexshelf: {
    name: "Nexshelf Store",
    type: "First-party channel",
  },
};

export default function SalesChannelsPage() {
  const [activeDialog, setActiveDialog] = useState(null);
  const [shopDomain, setShopDomain] = useState("");
  const [shopDomainError, setShopDomainError] = useState("");
  const [shopifyNotice, setShopifyNotice] = useState("");

  const validateShopDomain = (event) => {
    event.preventDefault();
    const normalizedDomain = shopDomain.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalizedDomain)) {
      setShopDomainError(
        "Enter your store domain, such as northstar.myshopify.com.",
      );
      setShopifyNotice("");
      return;
    }

    setShopDomainError("");
    setShopifyNotice(
      "The store domain is valid. Shopify authorization is not configured yet, so no connection or token was created.",
    );
  };

  const openShopifyDialog = () => {
    setActiveDialog("shopify");
    setShopifyNotice("");
    setShopDomainError("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Channels"
        description="Manage the places this company sells and publishes its catalog."
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Company-wide channels
            </p>
            <p className="text-xs text-muted-foreground">
              Channel connections belong to the company. Product pricing and
              fulfillment can vary by branch.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-border bg-background text-muted-foreground"
        >
          0 connected
        </Badge>
      </div>

      <section
        className="space-y-3"
        aria-labelledby="available-channels-heading"
      >
        <div>
          <h2
            id="available-channels-heading"
            className="text-sm font-semibold text-foreground"
          >
            Available channels
          </h2>
          <p className="text-xs text-muted-foreground">
            Connect an external platform or prepare Nexshelf&apos;s own
            storefront separately.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-lg shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <Store className="size-5 text-foreground" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm">
                    {CHANNELS.shopify.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {CHANNELS.shopify.type}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700"
              >
                Not connected
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Publish Nexshelf products to a Shopify store and bring channel
                activity into Sales.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-sm bg-muted px-2 py-1">
                  Catalog publishing
                </span>
                <span className="rounded-sm bg-muted px-2 py-1">
                  Variant mapping
                </span>
                <span className="rounded-sm bg-muted px-2 py-1">
                  Order sync
                </span>
              </div>
              <Button size="sm" onClick={openShopifyDialog}>
                Connect Shopify
                <ArrowUpRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-border px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-core/15 bg-core_light">
                  <Globe2 className="size-5 text-core" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm">
                    {CHANNELS.nexshelf.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {CHANNELS.nexshelf.type}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-border bg-muted text-muted-foreground"
              >
                Not configured
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Nexshelf&apos;s own storefront will be a first-party channel,
                independent of Shopify and other providers.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-sm bg-muted px-2 py-1">
                  Native storefront
                </span>
                <span className="rounded-sm bg-muted px-2 py-1">
                  Shared catalog
                </span>
                <span className="rounded-sm bg-muted px-2 py-1">
                  Branch fulfillment
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveDialog("nexshelf")}
              >
                View setup plan
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog
        dialogOpen={Boolean(activeDialog)}
        setDialogOpen={(open) => !open && setActiveDialog(null)}
      >
        <DialogContent>
          {activeDialog === "shopify" ? (
            <>
              <DialogHeader>
                <DialogTitle>Connect Shopify</DialogTitle>
                <DialogDescription>
                  Enter the store domain to prepare a secure Shopify
                  authorization flow.
                </DialogDescription>
              </DialogHeader>
              <form
                id="shopify-domain-form"
                onSubmit={validateShopDomain}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="shop-domain">Shop domain</Label>
                  <Input
                    id="shop-domain"
                    autoComplete="url"
                    placeholder="northstar.myshopify.com"
                    value={shopDomain}
                    onChange={(event) => {
                      setShopDomain(event.target.value);
                      setShopDomainError("");
                      setShopifyNotice("");
                    }}
                  />
                  {shopDomainError && (
                    <p className="text-xs text-destructive">
                      {shopDomainError}
                    </p>
                  )}
                  {shopifyNotice && (
                    <p
                      role="status"
                      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                    >
                      {shopifyNotice}
                    </p>
                  )}
                </div>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActiveDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" form="shopify-domain-form">
                  Validate store
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Nexshelf Store</DialogTitle>
                <DialogDescription>
                  This is a separate, first-party channel and will not require a
                  Shopify connection.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Its setup will use the shared company catalog, branch-specific
                  pricing and fulfillment, and a native storefront experience.
                </p>
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                  Storefront creation and checkout are not configured yet. This
                  screen does not create or publish a store.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setActiveDialog(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
