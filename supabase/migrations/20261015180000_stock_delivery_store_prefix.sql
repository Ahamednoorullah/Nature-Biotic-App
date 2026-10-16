-- New stock deliveries use the source store code, for example SAI-SD-0001.
-- Existing delivery numbers stay as they were saved.
update public.document_sequences
   set prefix = '{STORE}-SD-'
 where doc_type = 'delivery_challan'
   and scope_key in ('*', 'GLOBAL')
   and prefix = 'SD-';

update public.document_sequences
   set prefix = scope_key || '-SD-'
 where doc_type = 'delivery_challan'
   and scope_key not in ('*', 'GLOBAL')
   and prefix = 'SD-';
