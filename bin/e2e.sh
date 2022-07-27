#!/usr/bin/env sh
#
# End-to-end test script

SPIN_INSTANCE='cli-end-to-end'
APP_NAME='cli-end-to-end-app'
APP_TEMPLATE='node' # {node|php|ruby}
EXTENSION_NAME='cli-end-to-end-extension'
EXTENSION_TYPE='checkout_ui_extension' # {product_subscription|checkout_ui_extension|checkout_post_purchase|web_pixel_extension|pos_ui_extension|product_discounts|order_discounts|shipping_discounts|payment_methods|shipping_rate_presenter}
EXTENSION_TEMPLATE='react' # {vanilla-js|react}

echo "$0: Spinning up $SPIN_INSTANCE..."
SPIN_INSTANCE="$SPIN_INSTANCE" spin up extensions-sandbox-app --name "$SPIN_INSTANCE" --wait

for $AVAIL in $AVAIL_LIST; do
    AVAIL_LIST="$(spin list -H -o fqdn,status | cut -d. -f1)"
    echo "$0: Awaiting instance $SPIN_INSTANCE..."
    if [ "$AVAIL" | cut -d' ' -f1 = "$SPIN_INSTANCE" ] && [ "$AVAIL" | cut -d' ' -f2 = "available" ]; then
        break
    fi
done

echo "$0: $SPIN_INSTANCE available... Setting beta flags"
INSTANCE_LIST="$(spin list -H -o fqdn | cut -d. -f1)"
for $INSTANCE in $INSTANCE_LIST; do
    if [ "$INSTANCE" = "$SPIN_INSTANCE" ]; then
        echo "ssh spin@$INSTANCE 'cd shopify && SHOP_ID=1 BETA=checkout_one_argo_extensions bin/rake dev:betas:enable'"
        ssh "spin@${INSTANCE} 'cd shopify && SHOP_ID=1 BETA=checkout_one_argo_extensions bin/rake dev:betas:enable'"
        break
    fi
done

sleep 5
# SPIN_INSTANCE="$SPIN_INSTANCE" spin shell 'cd shopify && SHOP_ID=1 BETA=checkout_one_argo_extensions bin/rake dev:betas:enable'

echo "$0: Creating app: $APP_NAME..."
SPIN_INSTANCE="$SPIN_INSTANCE" dev spin yarn create-app --local --name $APP_NAME --template $APP_TEMPLATE

echo "$0: Creating extension: $EXTENSION_NAME..."
SPIN_INSTANCE="$SPIN_INSTANCE" dev spin yarn shopify app scaffold extension --name $EXTENSION_NAME --type $EXTENSION_TYPE --template $EXTENSION_TEMPLATE --path $APP_NAME
