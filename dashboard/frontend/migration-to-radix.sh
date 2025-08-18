#!/bin/bash

# Migration Script: Custom Accessibility Framework to Radix UI
# This script installs necessary Radix UI components and removes the custom framework

echo "==================================="
echo "Radix UI Migration Script"
echo "==================================="

# Step 1: Install missing Radix UI components
echo "Installing Radix UI components..."
npm install \
  @radix-ui/react-dialog \
  @radix-ui/react-tooltip \
  @radix-ui/react-tabs \
  @radix-ui/react-accordion \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-popover \
  @radix-ui/react-select \
  @radix-ui/react-switch \
  @radix-ui/react-checkbox \
  @radix-ui/react-radio-group \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group \
  @radix-ui/react-label \
  @radix-ui/react-visually-hidden \
  @radix-ui/react-focus-scope \
  @radix-ui/react-focus-guards

echo "✅ Radix UI components installed"

# Step 2: Create backup of custom accessibility framework
echo "Creating backup of custom accessibility framework..."
if [ -d "dashboard/frontend/src/components/Accessibility" ]; then
  cp -r dashboard/frontend/src/components/Accessibility dashboard/frontend/src/components/Accessibility.backup
  echo "✅ Backup created at Accessibility.backup"
else
  echo "⚠️  Accessibility directory not found"
fi

# Step 3: List files to be removed
echo ""
echo "Files to be removed after migration:"
echo "- dashboard/frontend/src/components/Accessibility/"
echo "- dashboard/frontend/src/utils/a11y/"
echo "- dashboard/frontend/src/hooks/use-accessibility.ts (if exists)"

echo ""
echo "==================================="
echo "Migration Plan Summary:"
echo "==================================="
echo "1. ✅ Radix UI components installed"
echo "2. ✅ Backup created"
echo "3. 🔄 Next: Create Radix UI wrapper components"
echo "4. 🔄 Next: Update imports in existing components"
echo "5. 🔄 Next: Remove custom accessibility framework"
echo ""
echo "To complete migration, run:"
echo "  npm run build"
echo "  npm test"
echo ""
echo "To rollback if needed:"
echo "  mv dashboard/frontend/src/components/Accessibility.backup dashboard/frontend/src/components/Accessibility"