export interface UserError {
  field: string;
  message: string;
}

export interface BulkOperation {
  id: string;
  status: string;
}
