import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePresignedDownloadUrl } from "../hooks/usePresignedDownloadUrl";
import Spinner from "./Spinner";
import Modal from "./Modal";
import Button from "./Button";
import { HiZoomIn, HiZoomOut } from "react-icons/hi";
import { FiRefreshCw } from "react-icons/fi";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface ImagePreviewProps {
  s3Key: string;
  filename: string;
  thumbnailHeight?: number;
  boundingBox?: {
    label: string;
    coordinates: [number, number, number, number]; // [x1, y1, x2, y2]
  };
}

export default function ImagePreview({
  s3Key,
  filename,
  thumbnailHeight = 100,
  boundingBox,
}: ImagePreviewProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const { getPresignedUrl, isLoading, error } = usePresignedDownloadUrl();
  const imageRef = useRef<HTMLImageElement>(null);
  const modalImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        const presignedUrl = await getPresignedUrl(s3Key);
        setUrl(presignedUrl);
      } catch (err) {
        console.error("Failed to get presigned URL", err);
      }
    };

    fetchUrl();
  }, [s3Key]); // getPresignedUrlを依存配列から除外

  // モーダル内の画像がロードされたときにサイズを取得
  const handleModalImageLoad = () => {
    if (modalImageRef.current) {
      setImageSize({
        width: modalImageRef.current.naturalWidth,
        height: modalImageRef.current.naturalHeight,
      });
    }
  };

  // バウンディングボックスを描画する関数
  const renderBoundingBox = () => {
    if (!boundingBox || !imageSize) return null;

    const { coordinates, label } = boundingBox;
    const [x1, y1, x2, y2] = coordinates;

    // Nova の座標は 0-1000 のスケールなので、実際の画像サイズに変換（パーセンテージに）
    const percentX1 = x1 / 10; // 0-100%
    const percentY1 = y1 / 10;
    const percentX2 = x2 / 10;
    const percentY2 = y2 / 10;
    const percentWidth = percentX2 - percentX1;
    const percentHeight = percentY2 - percentY1;

    // CSSのパーセンテージを使用してバウンディングボックスを配置
    const boxStyle = {
      position: "absolute" as const,
      left: `${percentX1}%`,
      top: `${percentY1}%`,
      width: `${percentWidth}%`,
      height: `${percentHeight}%`,
      border: "2px solid red",
      boxSizing: "border-box" as const,
      pointerEvents: "none" as const,
    };

    const labelStyle = {
      position: "absolute" as const,
      left: `${percentX1}%`,
      top: `${Math.max(0, percentY1 - 5)}%`, // 上部に少し余裕を持たせる
      backgroundColor: "rgba(255, 0, 0, 0.7)",
      color: "white",
      padding: "2px 4px",
      fontSize: "12px",
      borderRadius: "2px",
      pointerEvents: "none" as const,
      whiteSpace: "nowrap" as const,
    };

    return (
      <>
        <div style={boxStyle}></div>
        <div style={labelStyle}>{label}</div>
      </>
    );
  };

  if (isLoading) {
    return <Spinner size="sm" />;
  }

  if (error) {
    return <div className="text-red-500">{t("imagePreview.failedToGetUrl")}</div>;
  }

  if (!url) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-start">
        <div
          className="relative overflow-hidden rounded border border-light-gray"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => setIsModalOpen(true)}
        >
          <img
            ref={imageRef}
            src={url}
            alt={filename}
            style={{ height: thumbnailHeight }}
            className="object-contain cursor-pointer transition-opacity"
          />

          {/* Hover overlay with zoom icon */}
          <div
            className={`absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center transition-opacity duration-200 ${
              isHovering ? "opacity-100" : "opacity-0"
            }`}
          >
            <HiZoomIn className="text-white h-6 w-6" />
            <span className="text-white text-xs mt-1">{t("imagePreview.zoomView")}</span>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={filename}
          size="lg"
        >
          <div className="flex flex-col items-center w-full">
            <TransformWrapper
              initialScale={1}
              initialPositionX={0}
              initialPositionY={0}
              minScale={0.5}
              maxScale={5}
              wheel={{ step: 0.1 }}
              centerOnInit={true}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="flex justify-center gap-2 mb-3 w-full">
                    <Button
                      onClick={() => zoomIn()}
                      variant="secondary"
                      size="sm"
                      icon={<HiZoomIn className="h-4 w-4" />}
                    >
                      {t("imagePreview.zoomIn")}
                    </Button>
                    <Button
                      onClick={() => zoomOut()}
                      variant="secondary"
                      size="sm"
                      icon={<HiZoomOut className="h-4 w-4" />}
                    >
                      {t("imagePreview.zoomOut")}
                    </Button>
                    <Button
                      onClick={() => resetTransform()}
                      variant="secondary"
                      size="sm"
                      icon={<FiRefreshCw className="h-4 w-4" />}
                    >
                      {t("imagePreview.reset")}
                    </Button>
                  </div>
                  <div className="w-full flex justify-center">
                    <TransformComponent wrapperStyle={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <div className="relative">
                        <img
                          ref={modalImageRef}
                          src={url}
                          alt={filename}
                          className="max-w-full max-h-[60vh] object-contain"
                          onLoad={handleModalImageLoad}
                        />
                        {boundingBox && imageSize && renderBoundingBox()}
                      </div>
                    </TransformComponent>
                  </div>
                </>
              )}
            </TransformWrapper>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsModalOpen(false)}>{t("common.close")}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
