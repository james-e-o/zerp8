import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({
  spinning,
  className,
  ...props
}) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(`size-4 ${spinning&&'animate-spin'}`, className)}
      {...props} />
  );
}

export { Spinner }

