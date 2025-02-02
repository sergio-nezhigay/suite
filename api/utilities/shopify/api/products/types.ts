export interface BulkOperation {
  id: string;
  status: string;
}

export interface UserError {
  field: string;
  message: string;
}
