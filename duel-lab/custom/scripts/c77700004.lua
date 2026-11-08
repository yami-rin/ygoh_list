--連鎖律－アセンブラ
--Chain Code - Assembler (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	--① a "Chain Code" monster is Normal/Special Summoned to your field: Special Summon this card from hand/banishment
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e1:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SUMMON_SUCCESS)
	e1:SetRange(LOCATION_HAND+LOCATION_REMOVED)
	e1:SetCountLimit(1,{id,0})
	e1:SetCondition(s.spcon)
	e1:SetTarget(s.sptg)
	e1:SetOperation(s.spop)
	c:RegisterEffect(e1)
	local e1b=e1:Clone()
	e1b:SetCode(EVENT_SPSUMMON_SUCCESS)
	c:RegisterEffect(e1b)
	--② (once per turn) either player's Main Phase: Link Summon a "Chain Code" Link Monster using your monsters
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetHintTiming(0,TIMINGS_CHECK_MONSTER|TIMING_MAIN_END)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(function() return Duel.IsMainPhase() end)
	e2:SetTarget(s.lktg)
	e2:SetOperation(s.lkop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CHAIN_CODE}
function s.cfilter(c,tp)
	return c:IsFaceup() and c:IsSetCard(SET_CHAIN_CODE) and c:IsControler(tp)
end
function s.spcon(e,tp,eg,ep,ev,re,r,rp)
	return eg:IsExists(s.cfilter,1,nil,tp)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and c:IsCanBeSpecialSummoned(e,0,tp,false,false) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,c,1,tp,0)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsRelateToEffect(e) then Duel.SpecialSummon(c,0,tp,tp,false,false,POS_FACEUP) end
end
function s.lkfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsLinkMonster() and c:IsLinkSummonable()
end
function s.thfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsSpellTrap() and c:IsAbleToHand() and (c:IsLocation(LOCATION_DECK) or c:IsFaceup())
end
function s.lktg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.lkfilter,tp,LOCATION_EXTRA,0,1,nil) end
	--Chain Link number of this activation ("activated as Chain Link 3 or higher")
	e:SetLabel(Duel.GetCurrentChain())
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.lkop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sc=Duel.SelectMatchingCard(tp,s.lkfilter,tp,LOCATION_EXTRA,0,1,1,nil):GetFirst()
	if not sc then return end
	Duel.LinkSummon(tp,sc)
	if e:GetLabel()>=3 then
		local g=Duel.GetMatchingGroup(s.thfilter,tp,LOCATION_DECK+LOCATION_REMOVED,0,nil)
		if #g>0 then
			Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
			local sg=g:Select(tp,1,1,nil)
			Duel.SendtoHand(sg,nil,REASON_EFFECT)
			Duel.ConfirmCards(1-tp,sg)
		end
	end
end
