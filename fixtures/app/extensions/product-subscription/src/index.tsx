import React from 'react';
import {extend, render} from '@shopify/admin-ui-extensions-react'

import {TextFieldExample} from './text-field';

// Your extension must render all four modes
extend('Admin::Product::SubscriptionPlan::Add', render(() => <TextFieldExample/>))
extend('Admin::Product::SubscriptionPlan::Create', render(() => <TextFieldExample/>))
extend('Admin::Product::SubscriptionPlan::Remove', render(() => <TextFieldExample/>))
extend('Admin::Product::SubscriptionPlan::Edit', render(() => <TextFieldExample/>))
extend('Playground', render(() => <TextFieldExample/>))
