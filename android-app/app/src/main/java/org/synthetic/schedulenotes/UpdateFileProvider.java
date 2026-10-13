package org.synthetic.schedulenotes;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

public final class UpdateFileProvider extends ContentProvider {
    private static final String[] DEFAULT_COLUMNS = { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };

    static File updateDirectory(android.content.Context context) {
        File downloads = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return downloads == null ? null : new File(downloads, "updates");
    }

    static Uri uriFor(android.content.Context context, File file) {
        return new Uri.Builder()
            .scheme("content")
            .authority(context.getPackageName() + ".updatefiles")
            .appendPath(file.getName())
            .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("只允许读取更新文件");
        File file = resolveFile(uri);
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File file;
        try { file = resolveFile(uri); }
        catch (FileNotFoundException error) { return null; }
        String[] columns = projection == null ? DEFAULT_COLUMNS : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) row.add(file.getName());
            else if (OpenableColumns.SIZE.equals(column)) row.add(file.length());
            else row.add(null);
        }
        return cursor;
    }

    private File resolveFile(Uri uri) throws FileNotFoundException {
        if (getContext() == null || uri == null || uri.getPathSegments().size() != 1) {
            throw new FileNotFoundException("更新文件地址无效");
        }
        String filename = uri.getLastPathSegment();
        if (filename == null || !filename.matches("update-[0-9]+\\.apk")) {
            throw new FileNotFoundException("更新文件名无效");
        }
        File root = updateDirectory(getContext());
        if (root == null) throw new FileNotFoundException("更新目录不可用");
        try {
            File canonicalRoot = root.getCanonicalFile();
            File target = new File(canonicalRoot, filename).getCanonicalFile();
            if (!target.getParentFile().equals(canonicalRoot) || !target.isFile()) {
                throw new FileNotFoundException("更新文件不存在");
            }
            return target;
        } catch (IOException error) {
            throw new FileNotFoundException("无法读取更新文件");
        }
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException("只读"); }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { throw new UnsupportedOperationException("只读"); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { throw new UnsupportedOperationException("只读"); }
}
