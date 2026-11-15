import Image from 'next/image';

export default function LibraryBannerArt({ src }: { src: string }) {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-20 w-full sm:w-3/5 sm:max-w-[820px] sm:[mask-image:linear-gradient(to_right,transparent,black_40%)]">
        <Image src={src} alt="" fill unoptimized sizes="(min-width: 1367px) 820px, (min-width: 640px) 60vw, 100vw" className="object-cover object-[right_48%]" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#10283e]/95 via-[#10283e]/60 to-[#10283e]/15 sm:hidden" />
    </>
  );
}
